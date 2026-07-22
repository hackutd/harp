import { zodResolver } from "@hookform/resolvers/zod";
import { AlertCircle } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { FormProvider, useForm } from "react-hook-form";
import { useNavigate } from "react-router-dom";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Input } from "@/components/ui/input";
import { errorAlert, getRequest, postRequest } from "@/shared/lib/api";
import {
  buildDefaultValues,
  deriveSections,
  groupFieldsBySection,
  resolveResumeSectionId,
} from "@/shared/lib/schema-utils";
import type { Application, ApplicationSchemaField } from "@/types";

import {
  deleteMyResume as deleteResume,
  MAX_RESUME_SIZE_BYTES as MAX_RESUME_UPLOAD_SIZE_BYTES,
  requestResumeUploadURL as getResumeUploadURL,
  type UpdateApplicationPayload,
  updateMyApplication,
  uploadResumeToSignedURL as uploadToSignedURL,
} from "../api";
import { AgreementsStep } from "../steps/AgreementsStep";
import { ReviewStep } from "../steps/ReviewStep";
import { SchemaStepRenderer } from "../steps/SchemaStepRenderer";
import { SponsorInfoStep } from "../steps/SponsorInfoStep";
import { buildApplicationSchema } from "../validations";
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

/** Sections that become wizard steps, derived dynamically from the schema. */

/**
 * Extract form values from the API Application object.
 * Responses are a flat key-value object; ack fields are top-level.
 */
function transformApplicationToFormData(
  app: Application,
  schemaFields: ApplicationSchemaField[],
): Record<string, unknown> {
  const defaults = buildDefaultValues(schemaFields);
  const responses = app.responses ?? {};

  // Merge stored responses over defaults
  const data: Record<string, unknown> = { ...defaults };
  for (const [key, value] of Object.entries(responses)) {
    if (value !== null && value !== undefined) {
      data[key] = value;
    }
  }

  return data;
}

/**
 * Transform form data into the API payload shape: { responses: {...} }
 */
function transformFormDataToPayload(
  data: Record<string, unknown>,
  schemaFields: ApplicationSchemaField[],
): UpdateApplicationPayload {
  const schemaFieldIds = new Set(schemaFields.map((f) => f.id));
  const responses: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(data)) {
    if (schemaFieldIds.has(key)) {
      responses[key] = value;
    }
  }

  return { responses };
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
  const [isUploadingResume, setIsUploadingResume] = useState(false);
  const [isDeletingResume, setIsDeletingResume] = useState(false);
  const [applicationsEnabled, setApplicationsEnabled] = useState(true);
  // Schema is captured once from the initial load; mutation responses
  // (PATCH/DELETE) don't embed it and must not wipe it.
  const [schemaFields, setSchemaFields] = useState<ApplicationSchemaField[]>(
    [],
  );

  const isResumeBusy = isUploadingResume || isDeletingResume;
  const isDraft = application?.status === "draft";

  const autosaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Serializes saves so a slow request can't land after (and overwrite) a
  // newer one.
  const saveChain = useRef<Promise<boolean>>(Promise.resolve(true));

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

  // Build Zod schema dynamically from application_schema
  const formSchema = useMemo(
    () => buildApplicationSchema(schemaFields),
    [schemaFields],
  );

  const form = useForm({
    resolver: zodResolver(formSchema),
    defaultValues: buildDefaultValues(schemaFields),
    mode: "onTouched",
  });

  // Load existing application data and check if applications are enabled
  useEffect(() => {
    const loadApplication = async () => {
      const [appRes, enabledRes] = await Promise.all([
        getRequest<Application>("/applications/me", "application"),
        getRequest<{ enabled: boolean }>(
          "/applications/enabled",
          "applications status",
        ),
      ]);

      if (appRes.status === 200 && appRes.data) {
        const app = appRes.data;
        setApplication(app);
        const schema = app.application_schema ?? [];
        setSchemaFields(schema);
        const formData = transformApplicationToFormData(app, schema);
        const defaults = buildDefaultValues(schema);
        form.reset({ ...defaults, ...formData });

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
  }, [form]);

  // Clamp so the index stays valid if the schema-driven steps ever shrink
  const safeCurrentStep = Math.min(currentStep, steps.length - 1);

  // Save the current form values as a draft. Saves run one at a time.
  const saveDraft = useCallback((): Promise<boolean> => {
    const run = async (): Promise<boolean> => {
      setAutosaveState("saving");
      const payload = transformFormDataToPayload(
        form.getValues(),
        schemaFields,
      );
      const res = await updateMyApplication(payload);
      if (res.status === 200 && res.data) {
        setApplication(res.data);
        setAutosaveState("saved");
        return true;
      }
      setAutosaveState("error");
      return false;
    };
    const next = saveChain.current.then(run, run);
    saveChain.current = next.catch(() => false);
    return next;
  }, [form, schemaFields]);

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

  // Autosave whenever the user edits a field. (form.watch returns an RHF
  // subscription; the React Compiler flags it as a non-memoizable library
  // call, which is a benign informational warning here.)
  useEffect(() => {
    if (loading || !applicationsEnabled || !isDraft) return;
    const subscription = form.watch((_, { name }) => {
      // Ignore programmatic bulk updates like form.reset
      if (!name) return;
      scheduleAutosave();
    });
    return () => {
      subscription.unsubscribe();
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
    if (isResumeBusy) return;
    setApiError(null);
    const isValid = await validateCurrentStep();
    if (!isValid) return;

    // Save progress before advancing
    cancelPendingAutosave();
    setSaving(true);
    const saved = await saveDraft();
    setSaving(false);

    if (!saved) {
      setApiError("Failed to save progress");
      return;
    }

    setCurrentStep((prev) => Math.min(prev + 1, steps.length - 1));
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const goToPreviousStep = () => {
    if (isResumeBusy) return;
    setApiError(null);
    setCurrentStep((prev) => Math.max(prev - 1, 0));
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const goToStep = (stepIndex: number) => {
    if (isResumeBusy) return;
    setApiError(null);
    setCurrentStep(stepIndex);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const submitApplication = async () => {
    if (isResumeBusy) return;
    setSubmitting(true);
    setApiError(null);

    // Validate all fields
    const isValid = await form.trigger();
    if (!isValid) {
      setApiError("Please complete all required fields before submitting");
      setSubmitting(false);
      return;
    }

    // Save current state first
    cancelPendingAutosave();
    const saved = await saveDraft();

    if (!saved) {
      setApiError("Failed to save before submitting");
      setSubmitting(false);
      return;
    }

    // Now submit
    const submitRes = await postRequest<Application>(
      "/applications/me/submit",
      {},
      "application",
    );

    if (submitRes.status === 200 && submitRes.data) {
      setApplication(submitRes.data);
      if (application?.id) {
        localStorage.removeItem(stepStorageKey(application.id));
      }
      navigate("/app/status", {
        state: { justSubmitted: application!.id },
      });
    } else {
      setApiError(submitRes.error || "Failed to submit application");
      errorAlert(submitRes);
    }
    setSubmitting(false);
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
      setAutosaveState("saved");
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
      setAutosaveState("saved");
    } else {
      setApiError(res.error || "Failed to delete resume");
      errorAlert(res);
    }

    setIsDeletingResume(false);
  };

  // Loading state
  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-24">
        <div className="size-10 animate-spin rounded-full border-b-2 border-black"></div>
        <p className="mt-4 text-sm font-light text-[#8A8A8A]">
          Loading your application...
        </p>
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
          onClick={() => navigate("/app/status")}
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

    // Agreements section gets a dedicated accordion-based layout
    if (section === "agreements") {
      return (
        <AgreementsStep
          sectionLabel={sectionLabels[section] ?? section}
          fields={fields}
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
  const handleBack = () => {
    if (autosaveTimer.current) {
      cancelPendingAutosave();
      void saveDraft();
    }
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
        {apiError && (
          <Alert variant="destructive" className="mb-6">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Error</AlertTitle>
            <AlertDescription>{apiError}</AlertDescription>
          </Alert>
        )}

        <p
          aria-live="polite"
          className={`mb-4 h-4 text-xs font-light ${
            autosaveState === "error"
              ? "text-red-500"
              : autosaveState === "saved"
                ? "text-[#09D082]"
                : "text-[#8A8A8A]"
          }`}
        >
          {autosaveState === "saving" && "Saving..."}
          {autosaveState === "saved" && "Saved"}
          {autosaveState === "error" &&
            "Couldn't save your changes — check your connection"}
        </p>

        <FormProvider {...form}>
          <form onSubmit={(e) => e.preventDefault()}>
            {renderStep()}

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
