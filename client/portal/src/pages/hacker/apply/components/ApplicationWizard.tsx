import { AlertCircle } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { FormProvider, useForm, useWatch } from "react-hook-form";
import { useNavigate } from "react-router";

import { IncompleteFormAlert } from "@/components/IncompleteFormAlert";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { errorAlert, getRequest, postRequest } from "@/shared/lib/api";
import { DEFAULT_FEATURE_FLAGS } from "@/shared/lib/feature-defaults";
import {
  collectIncompleteSections,
  scrollToFirstInvalidField,
} from "@/shared/lib/form-errors";
import {
  buildDefaultValues,
  buildZodSchema,
  deriveSections,
  getObsoleteOptions,
  groupFieldsBySection,
  resolveResumeSectionId,
  stripLabelLinks,
} from "@/shared/lib/schema-utils";
import type { ApiResponse, Application, ApplicationSchemaField } from "@/types";

import {
  deleteMyResume as deleteResume,
  MAX_RESUME_SIZE_BYTES as MAX_RESUME_UPLOAD_SIZE_BYTES,
  requestResumeUploadURL as getResumeUploadURL,
  updateMyApplication,
  uploadResumeToSignedURL as uploadToSignedURL,
} from "../api";
import {
  createDraftSaver,
  draftStepIds,
  reconcileDraftStep,
  reconcileDraftValues,
} from "../draft";
import { ReviewStep } from "../steps/ReviewStep";
import { SchemaStepRenderer } from "../steps/SchemaStepRenderer";
import { SponsorInfoStep } from "../steps/SponsorInfoStep";
import { buildApplicationResolver } from "../validations";
import { OutdatedAnswersNotice } from "./OutdatedAnswersNotice";
import { StepIndicator } from "./StepIndicator";
import { StepNavigation } from "./StepNavigation";

interface ApplicationWizardProps {
  userEmail?: string;
}

const PDF_MIME_TYPE = "application/pdf";
const MAX_RESUME_SIZE_MB = MAX_RESUME_UPLOAD_SIZE_BYTES / (1024 * 1024);
const AUTOSAVE_DEBOUNCE_MS = 1200;

type AutosaveState = "idle" | "saving" | "saved" | "error";

function stepStorageKey(applicationId: string): string {
  return `harp-apply-step:${applicationId}`;
}

export function ApplicationWizard({ userEmail }: ApplicationWizardProps) {
  const navigate = useNavigate();
  const [currentStep, setCurrentStep] = useState(0);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [application, setApplication] = useState<Application | null>(null);
  const [apiError, setApiError] = useState<string | null>(null);
  const [autosaveState, setAutosaveState] = useState<AutosaveState>("idle");
  const [saveError, setSaveError] = useState<string | null>(null);
  const [refreshFailed, setRefreshFailed] = useState(false);
  const [refreshingSchema, setRefreshingSchema] = useState(false);
  const [incompleteDescription, setIncompleteDescription] = useState(
    "Answer the questions below, then submit again.",
  );
  const [isUploadingResume, setIsUploadingResume] = useState(false);
  const [isDeletingResume, setIsDeletingResume] = useState(false);
  const [applicationsEnabled, setApplicationsEnabled] = useState<boolean>(
    DEFAULT_FEATURE_FLAGS.applicationsEnabled,
  );
  // GET/PATCH and resume deletion can carry updated questions.
  const [schemaFields, setSchemaFields] = useState<ApplicationSchemaField[]>(
    [],
  );

  const isResumeBusy = isUploadingResume || isDeletingResume;
  const isDraft = application?.status === "draft";

  const autosaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const schemaRef = useRef<ApplicationSchemaField[]>([]);
  const editRevision = useRef(0);
  const reconcilingSchema = useRef(false);
  const submissionInProgress = useRef(false);
  const serverFieldIds = useRef<string[]>([]);

  // Derive sections from the schema
  const schemaSections = useMemo(
    () => deriveSections(schemaFields),
    [schemaFields],
  );

  // Group fields by section
  const grouped = useMemo(
    () => groupFieldsBySection(schemaFields),
    [schemaFields],
  );

  // Build step definitions from schema sections (+ review step at end)
  const steps = useMemo(() => {
    const sectionSteps = schemaSections
      .filter((s) => grouped[s.id] && grouped[s.id].length > 0)
      .map((s) => ({ id: s.id, title: s.label }));
    return [...sectionSteps, { id: "review" as const, title: "Review" }];
  }, [schemaSections, grouped]);

  // Section labels lookup
  const sectionLabels = useMemo(() => {
    const labels: Record<string, string> = {};
    for (const s of schemaSections) labels[s.id] = s.label;
    return labels;
  }, [schemaSections]);

  // Map section → step index for the review "Edit" buttons
  const sectionStepMap = useMemo(() => {
    const map: Record<string, number> = {};
    let idx = 0;
    for (const section of schemaSections) {
      if (grouped[section.id] && grouped[section.id].length > 0) {
        map[section.id] = idx;
        idx++;
      }
    }
    return map;
  }, [schemaSections, grouped]);

  // Section that hosts the resume uploader: "links" when present, otherwise
  // the last section, so renaming/removing "links" can't orphan the upload.
  const resumeSectionId = useMemo(
    () => resolveResumeSectionId(schemaFields),
    [schemaFields],
  );

  // Validate against a schema rebuilt from the current answers, so a question
  // that only applies once another is answered (e.g. the travel questions
  // behind the reimbursement opt-in) is enforced as soon as it appears.
  const resolver = useMemo(
    () => buildApplicationResolver(schemaFields),
    [schemaFields],
  );

  const form = useForm({
    resolver,
    defaultValues: buildDefaultValues(schemaFields),
    mode: "onTouched",
  });
  const values = useWatch({ control: form.control });

  const applySchema = useCallback(
    (schema: ApplicationSchemaField[] | undefined) => {
      if (
        !schema ||
        JSON.stringify(schema) === JSON.stringify(schemaRef.current)
      )
        return;
      const previous = schemaRef.current;
      schemaRef.current = schema;
      setSchemaFields(schema);
      setCurrentStep((index) => reconcileDraftStep(index, previous, schema));
      const current = form.getValues();
      const reconciled = reconcileDraftValues(current, schema);
      // Add newly introduced defaults without resetting answers or dirty state.
      reconcilingSchema.current = true;
      for (const field of schema) {
        if (!(field.id in current))
          form.setValue(field.id, reconciled[field.id]);
      }
      reconcilingSchema.current = false;
    },
    [form],
  );

  const refreshSchema = useCallback(async () => {
    setRefreshingSchema(true);
    const res = await getRequest<Application>(
      "/applications/me",
      "application",
    );
    const schema =
      res.status === 200 ? res.data?.application_schema : undefined;
    if (schema) applySchema(schema);
    setRefreshFailed(!schema);
    setRefreshingSchema(false);
    return schema ?? schemaRef.current;
  }, [applySchema]);

  const reportValidationFailure = useCallback(
    async (res: ApiResponse<Application>, context: "save" | "submit") => {
      const schema = await refreshSchema();
      const fields = new Map(schema.map((field) => [field.id, field]));
      const blamed = (res.fields ?? []).filter((id) => fields.has(id));
      serverFieldIds.current = blamed;
      for (const id of blamed) {
        form.setError(id, {
          type: "server",
          message: `${stripLabelLinks(fields.get(id)!.label)} needs a valid answer`,
        });
      }
      setIncompleteDescription(
        context === "save"
          ? "Review these answers so your draft can be saved."
          : "Review these answers, then submit again.",
      );
      setShowIncomplete(true);
    },
    [form, refreshSchema],
  );

  // Set once a submit attempt fails validation. The list itself is derived from
  // the live errors so it shrinks as the hacker fills the gaps in, and
  // disappears once nothing is left.
  const [showIncomplete, setShowIncomplete] = useState(false);
  const { errors: formErrors } = form.formState;
  const incompleteSections = useMemo(
    () =>
      showIncomplete ? collectIncompleteSections(schemaFields, formErrors) : [],
    [showIncomplete, formErrors, schemaFields],
  );

  // Load existing application data and check if applications are enabled
  useEffect(() => {
    const controller = new AbortController();
    const loadApplication = async () => {
      const [appRes, enabledRes] = await Promise.all([
        getRequest<Application>(
          "/applications/me",
          "application",
          controller.signal,
        ),
        getRequest<{ enabled: boolean }>(
          "/applications/enabled",
          "applications status",
          controller.signal,
        ),
      ]);
      if (controller.signal.aborted) return;

      if (appRes.status === 200 && appRes.data) {
        const app = appRes.data;
        setApplication(app);
        const schema = app.application_schema ?? [];
        schemaRef.current = schema;
        setSchemaFields(schema);
        form.reset(reconcileDraftValues(app.responses ?? {}, schema));

        // Restore the step the user last left off on
        if (app.status === "draft") {
          const sections = deriveSections(schema);
          const groupedFields = groupFieldsBySection(schema);
          const stepCount =
            sections.filter((s) => (groupedFields[s.id] ?? []).length > 0)
              .length + 1;
          const savedStep = Number(
            localStorage.getItem(stepStorageKey(app.id)) ?? "0",
          );
          if (Number.isInteger(savedStep) && savedStep > 0) {
            setCurrentStep(Math.min(savedStep, stepCount - 1));
          }
        }
      }

      if (enabledRes.status === 200 && enabledRes.data) {
        setApplicationsEnabled(enabledRes.data.enabled);
      }

      setLoading(false);
    };
    loadApplication();
    return () => controller.abort();
  }, [form]);

  // Clamp so the index stays valid if the schema-driven steps ever shrink
  const safeCurrentStep = Math.min(currentStep, steps.length - 1);

  // Save the current form values as a draft. Saves run one at a time.
  const saveDraft = useMemo(
    () =>
      createDraftSaver({
        read: () => ({
          values: form.getValues(),
          schema: schemaRef.current,
          revision: editRevision.current,
        }),
        request: updateMyApplication,
        onStart: () => {
          setAutosaveState("saving");
          setSaveError(null);
        },
        onSaved: (app) => {
          setApplication(app);
          applySchema(app.application_schema);
          if (serverFieldIds.current.length) {
            form.clearErrors(serverFieldIds.current);
            serverFieldIds.current = [];
          }
        },
        onFailure: async (res) => {
          if (res.status === 400) await reportValidationFailure(res, "save");
          setSaveError(
            res.status === 400
              ? "Some answers need attention before your draft can be saved."
              : "Couldn't save your changes. Please try again.",
          );
        },
        onFinish: ({ response, current }) => {
          setAutosaveState(
            response.status === 200 && response.data
              ? current
                ? "saved"
                : "idle"
              : "error",
          );
        },
      }),
    [applySchema, form, reportValidationFailure],
  );

  const cancelPendingAutosave = useCallback(() => {
    if (autosaveTimer.current) {
      clearTimeout(autosaveTimer.current);
      autosaveTimer.current = null;
    }
  }, []);

  const scheduleAutosave = useCallback(() => {
    cancelPendingAutosave();
    autosaveTimer.current = setTimeout(() => {
      autosaveTimer.current = null;
      void saveDraft();
    }, AUTOSAVE_DEBOUNCE_MS);
  }, [cancelPendingAutosave, saveDraft]);

  // Autosave whenever the user edits a field. Uses form.subscribe rather than
  // form.watch: watch() returns a non-memoizable value that makes the React
  // Compiler skip optimizing this component entirely.
  useEffect(() => {
    if (loading || !applicationsEnabled || !isDraft) return;
    let lastValues = JSON.stringify(form.getValues());
    const unsubscribe = form.subscribe({
      formState: { values: true },
      callback: ({ name, values: currentValues }) => {
        const serialized = JSON.stringify(currentValues);
        const changed = serialized !== lastValues;
        lastValues = serialized;
        // Ignore programmatic bulk updates like form.reset
        if (!name || !changed || reconcilingSchema.current) return;
        editRevision.current += 1;
        setAutosaveState("idle");
        if (!submissionInProgress.current) scheduleAutosave();
      },
    });
    return () => {
      unsubscribe();
      cancelPendingAutosave();
    };
  }, [
    form,
    loading,
    applicationsEnabled,
    isDraft,
    scheduleAutosave,
    cancelPendingAutosave,
  ]);

  // Remember the step the user was on so they can pick up where they left off
  useEffect(() => {
    if (!isDraft || !application?.id) return;
    localStorage.setItem(
      stepStorageKey(application.id),
      String(safeCurrentStep),
    );
  }, [isDraft, application?.id, safeCurrentStep]);

  // Get field IDs for the current step (for partial validation)
  const getCurrentStepFieldIds = (): string[] => {
    const stepDef = steps[safeCurrentStep];
    if (!stepDef || stepDef.id === "review") {
      return [];
    }
    const section = stepDef.id;
    return (grouped[section] ?? []).map((f) => f.id);
  };

  // Validate current step fields
  const validateCurrentStep = async (): Promise<boolean> => {
    const fieldIds = getCurrentStepFieldIds();
    const result = await form.trigger(
      fieldIds as (keyof typeof form.formState.errors)[],
    );
    return result;
  };

  const goToNextStep = async () => {
    if (isResumeBusy || saving || submitting) return;
    setApiError(null);
    const isValid = await validateCurrentStep();
    if (!isValid) {
      // Several fields are custom popover triggers that never take focus, so
      // point the user at the first gap explicitly.
      scrollToFirstInvalidField();
      return;
    }

    // Save progress before advancing
    cancelPendingAutosave();
    setSaving(true);
    const { response, current } = await saveDraft();
    setSaving(false);

    if (response.status !== 200 || !response.data || !current) return;

    const stepCount = draftStepIds(schemaRef.current).length;
    setCurrentStep((prev) => Math.min(prev + 1, stepCount - 1));
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const goToPreviousStep = () => {
    if (isResumeBusy || submitting) return;
    setApiError(null);
    setCurrentStep((prev) => Math.max(prev - 1, 0));
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const goToStep = (stepIndex: number) => {
    if (isResumeBusy || submitting) return;
    setApiError(null);
    setCurrentStep(stepIndex);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const submitApplication = async () => {
    if (isResumeBusy || submissionInProgress.current) return;
    submissionInProgress.current = true;
    setSubmitting(true);
    setApiError(null);
    cancelPendingAutosave();
    try {
      // Save first: the response may introduce new questions or choices. Read
      // the reconciled schema synchronously rather than awaiting a React render.
      const saved = await saveDraft();
      if (saved.response.status !== 200 || !saved.response.data) return;
      if (!saved.current) {
        setApiError(
          "Your answers changed while saving. Please review and submit again.",
        );
        return;
      }
      const currentValues = form.getValues();
      const validation = buildZodSchema(
        schemaRef.current,
        currentValues,
      ).safeParse(currentValues);
      form.clearErrors();
      setIncompleteDescription("Review these answers, then submit again.");
      if (!validation.success) {
        for (const issue of validation.error.issues) {
          const id = String(issue.path[0]);
          form.setError(id, { type: "submit", message: issue.message });
        }
        setShowIncomplete(true);
        window.scrollTo({ top: 0, behavior: "smooth" });
        return;
      }
      setShowIncomplete(false);

      const res = await postRequest<Application>(
        "/applications/me/submit",
        {},
        "application",
      );
      if (res.status === 200 && res.data) {
        setApplication(res.data);
        if (application?.id)
          localStorage.removeItem(stepStorageKey(application.id));
        navigate("/app", {
          state: { justSubmitted: res.data.id },
        });
        return;
      }

      if (res.status === 400) {
        await reportValidationFailure(res, "submit");
        setApiError(
          "Some answers are missing or invalid. Review your application and try again.",
        );
        window.scrollTo({ top: 0, behavior: "smooth" });
      } else {
        const message = "Couldn't submit your application. Please try again.";
        setApiError(message);
        errorAlert(res, message);
      }
    } finally {
      submissionInProgress.current = false;
      setSubmitting(false);
    }
  };

  const uploadResume = async (file: File) => {
    if (!application) return;
    if (isResumeBusy || saving || submitting) return;

    if (application.status !== "draft") {
      setApiError("Cannot update submitted application");
      return;
    }

    if (application.resume_path) {
      setApiError("Delete your current resume before uploading a new one.");
      return;
    }

    const isPDF =
      file.type === PDF_MIME_TYPE ||
      file.name.toLowerCase().trim().endsWith(".pdf");
    if (!isPDF) {
      setApiError("Resume must be a PDF file.");
      return;
    }

    if (file.size > MAX_RESUME_UPLOAD_SIZE_BYTES) {
      setApiError(`Resume must be ${MAX_RESUME_SIZE_MB} MB or smaller.`);
      return;
    }

    setApiError(null);
    setIsUploadingResume(true);

    const uploadURLRes = await getResumeUploadURL();
    if (uploadURLRes.status !== 200 || !uploadURLRes.data) {
      setApiError(uploadURLRes.error || "Failed to generate resume upload URL");
      errorAlert(uploadURLRes);
      setIsUploadingResume(false);
      return;
    }

    const uploadRes = await uploadToSignedURL(
      uploadURLRes.data.upload_url,
      file,
    );
    if (uploadRes.status < 200 || uploadRes.status >= 300) {
      setApiError(uploadRes.error || "Failed to upload resume");
      setIsUploadingResume(false);
      return;
    }

    const saveRes = await updateMyApplication({
      resume_path: uploadURLRes.data.resume_path,
    });
    if (saveRes.status === 200 && saveRes.data) {
      setApplication(saveRes.data);
      applySchema(saveRes.data.application_schema);
    } else {
      setApiError(saveRes.error || "Failed to save resume");
      errorAlert(saveRes);
    }
    setIsUploadingResume(false);
  };

  const removeResume = async () => {
    if (!application) return;
    if (isResumeBusy || saving || submitting) return;

    if (application.status !== "draft") {
      setApiError("Cannot update submitted application");
      return;
    }

    if (!application.resume_path) {
      setApiError("No resume found to delete.");
      return;
    }

    setApiError(null);
    setIsDeletingResume(true);

    const res = await deleteResume();
    if (res.status === 200 && res.data) {
      setApplication(res.data);
      applySchema(res.data.application_schema);
    } else {
      setApiError(res.error || "Failed to delete resume");
      errorAlert(res);
    }

    setIsDeletingResume(false);
  };

  // Loading state
  if (loading) {
    return (
      <div className="mx-auto max-w-md space-y-6 px-5 py-10 md:max-w-5xl">
        <Skeleton className="h-4 w-32" />
        <Skeleton className="h-9 w-64" />
        <div className="space-y-4">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="space-y-2">
              <Skeleton className="h-4 w-40" />
              <Skeleton className="h-11 w-full" />
            </div>
          ))}
        </div>
        <Skeleton className="h-12 w-full rounded-full" />
      </div>
    );
  }

  // Applications closed
  if (!applicationsEnabled) {
    return (
      <div className="mx-auto max-w-md space-y-4 px-5 py-10 md:max-w-5xl">
        <h1 className="text-3xl font-light tracking-tight text-black">
          Applications closed
        </h1>
        <p className="text-sm font-light text-[#8A8A8A]">
          The application portal is not currently accepting submissions. Please
          check back later.
          {application &&
            application.status === "draft" &&
            " Your draft has been saved and will be here when applications reopen."}
        </p>
      </div>
    );
  }

  // Read-only mode if application is already submitted
  if (application && application.status !== "draft") {
    return (
      <div className="mx-auto max-w-md space-y-4 px-5 py-10 md:max-w-5xl">
        <h1 className="text-3xl font-light tracking-tight text-black">
          Application submitted
        </h1>
        <p className="text-sm font-light text-[#8A8A8A]">
          {application.status === "submitted" &&
            "Your application is being reviewed."}
          {application.status === "accepted" &&
            "Congratulations! Your application has been accepted."}
          {application.status === "rejected" &&
            "Unfortunately, your application was not accepted."}
          {application.status === "waitlisted" &&
            "You have been placed on the waitlist."}
        </p>
        <button
          type="button"
          onClick={() => navigate("/app")}
          className="text-sm font-light text-black underline underline-offset-2"
        >
          View status
        </button>
      </div>
    );
  }

  // Render current step
  const renderStep = () => {
    const stepDef = steps[safeCurrentStep];
    if (!stepDef) return null;

    // Last step is always Review
    if (stepDef.id === "review") {
      return (
        <ReviewStep
          onEditStep={goToStep}
          userEmail={userEmail}
          schema={schemaFields}
          hasResume={Boolean(application?.resume_path)}
          sectionStepMap={sectionStepMap}
          resumeSectionId={resumeSectionId}
        />
      );
    }

    const section = stepDef.id;
    const fields = grouped[section] ?? [];

    // The resume section gets special handling for resume upload
    if (section === resumeSectionId) {
      return (
        <SponsorInfoStep
          sectionLabel={sectionLabels[section] ?? section}
          fields={fields}
          hasResume={Boolean(application?.resume_path)}
          isUploadingResume={isUploadingResume}
          isDeletingResume={isDeletingResume}
          onResumeSelected={uploadResume}
          onDeleteResume={removeResume}
        />
      );
    }

    // Personal section gets email display header
    const header =
      section === "personal" && userEmail ? (
        <div className="space-y-1.5">
          <label className="text-xs font-light text-[#8A8A8A]">Email</label>
          <Input
            value={userEmail}
            disabled
            className="h-11 rounded-none border-0 border-b border-[#D9D9D9] bg-transparent px-0 text-base font-light text-[#8A8A8A] shadow-none dark:bg-transparent"
          />
          <p className="text-xs font-light text-[#B8B8B8]">
            Email is from your account and cannot be changed here
          </p>
        </div>
      ) : undefined;

    return (
      <SchemaStepRenderer
        sectionLabel={sectionLabels[section] ?? section}
        fields={fields}
        header={header}
      />
    );
  };

  // The top back button always exits to the homepage; step navigation
  // happens only through the bottom bar. Flush any pending autosave first.
  const handleBack = async () => {
    if (saving || submitting || isResumeBusy) return;
    cancelPendingAutosave();
    setSaving(true);
    const { response, current } = await saveDraft();
    setSaving(false);
    if (response.status !== 200 || !response.data || !current) return;
    navigate("/app");
  };

  return (
    <div className="mx-auto w-full max-w-md px-5 pt-4 pb-32 md:max-w-5xl md:px-8">
      <StepIndicator
        currentStep={safeCurrentStep}
        totalSteps={steps.length}
        onBack={handleBack}
      />

      <div className="pt-6">
        <OutdatedAnswersNotice
          schema={schemaFields}
          values={values}
          onJumpToSection={(sectionId) =>
            goToStep(sectionStepMap[sectionId] ?? 0)
          }
          onClear={(field) => {
            if (submitting) return;
            const value = form.getValues(field.id);
            const obsolete = getObsoleteOptions(field, value);
            const next =
              field.type === "multi_select" && Array.isArray(value)
                ? value.filter((item) => !obsolete.includes(item))
                : "";
            form.setValue(field.id, next, {
              shouldDirty: true,
              shouldValidate: true,
            });
          }}
        />
        {incompleteSections.length > 0 && (
          <IncompleteFormAlert
            sections={incompleteSections}
            onJumpToSection={(sectionId) =>
              goToStep(sectionStepMap[sectionId] ?? 0)
            }
            className="mb-6"
            description={incompleteDescription}
          />
        )}

        {refreshFailed && (
          <div role="alert" className="mb-4 space-y-2 text-sm font-light">
            <p>
              Couldn't refresh the questions. Your answers are still on this
              page.
            </p>
            <button
              type="button"
              disabled={refreshingSchema || submitting}
              className="underline underline-offset-2"
              onClick={() => void refreshSchema()}
            >
              {refreshingSchema
                ? "Refreshing..."
                : "Retry refreshing questions"}
            </button>
          </div>
        )}

        {apiError && (
          <Alert variant="destructive" className="mb-6">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Error</AlertTitle>
            <AlertDescription>{apiError}</AlertDescription>
          </Alert>
        )}

        <p
          aria-live="polite"
          className={`mb-4 min-h-4 text-xs font-light ${
            autosaveState === "error"
              ? "text-red-500"
              : autosaveState === "saved"
                ? "text-emerald-600"
                : "text-[#8A8A8A]"
          }`}
        >
          {autosaveState === "saving" && "Saving..."}
          {autosaveState === "saved" && "Draft saved"}
          {autosaveState === "error" && (
            <>
              {saveError}{" "}
              <button
                type="button"
                disabled={saving || submitting}
                className="underline underline-offset-2"
                onClick={() => {
                  cancelPendingAutosave();
                  void saveDraft();
                }}
              >
                Try saving again
              </button>
            </>
          )}
        </p>

        <FormProvider {...form}>
          <form onSubmit={(e) => e.preventDefault()}>
            <fieldset disabled={submitting} className="min-w-0">
              {renderStep()}
            </fieldset>

            <StepNavigation
              currentStep={safeCurrentStep}
              onPrevious={goToPreviousStep}
              onNext={goToNextStep}
              onSubmit={submitApplication}
              isSaving={saving}
              isSubmitting={submitting}
              isResumeBusy={isResumeBusy}
              isLastStep={safeCurrentStep === steps.length - 1}
            />
          </form>
        </FormProvider>
      </div>
    </div>
  );
}
