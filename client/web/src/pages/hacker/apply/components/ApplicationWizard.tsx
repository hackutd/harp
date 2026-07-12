import { zodResolver } from "@hookform/resolvers/zod";
import { AlertCircle } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { FormProvider, useForm } from "react-hook-form";
import { useNavigate } from "react-router-dom";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Input } from "@/components/ui/input";
import { errorAlert, getRequest, postRequest } from "@/shared/lib/api";
import {
  buildDefaultValues,
  deriveSections,
  groupFieldsBySection,
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
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [isUploadingResume, setIsUploadingResume] = useState(false);
  const [isDeletingResume, setIsDeletingResume] = useState(false);
  const [applicationsEnabled, setApplicationsEnabled] = useState(true);

  const isResumeBusy = isUploadingResume || isDeletingResume;

  // Schema from the loaded application
  const schemaFields = useMemo(
    () => application?.application_schema ?? [],
    [application?.application_schema],
  );

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
        const formData = transformApplicationToFormData(app, schema);
        const defaults = buildDefaultValues(schema);
        form.reset({ ...defaults, ...formData });
      }

      if (enabledRes.status === 200 && enabledRes.data) {
        setApplicationsEnabled(enabledRes.data.enabled);
      }

      setLoading(false);
    };
    loadApplication();
  }, [form]);

  // Clear save success message after 3 seconds
  useEffect(() => {
    if (saveSuccess) {
      const timer = setTimeout(() => setSaveSuccess(false), 3000);
      return () => clearTimeout(timer);
    }
  }, [saveSuccess]);

  // Get field IDs for the current step (for partial validation)
  const getCurrentStepFieldIds = (): string[] => {
    const stepDef = steps[currentStep];
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

    // Autosave progress before advancing
    setSaving(true);
    const formData = form.getValues();
    const payload = transformFormDataToPayload(formData, schemaFields);
    const res = await updateMyApplication(payload);
    setSaving(false);

    if (res.status === 200 && res.data) {
      setApplication(res.data);
    } else {
      setApiError(res.error || "Failed to save progress");
      errorAlert(res);
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
    const formData = form.getValues();
    const payload = transformFormDataToPayload(formData, schemaFields);
    const saveRes = await updateMyApplication(payload);

    if (saveRes.status !== 200) {
      setApiError(saveRes.error || "Failed to save before submitting");
      errorAlert(saveRes);
      setSubmitting(false);
      return;
    }

    if (saveRes.data) {
      setApplication(saveRes.data);
    }

    // Now submit
    const submitRes = await postRequest<Application>(
      "/applications/me/submit",
      {},
      "application",
    );

    if (submitRes.status === 200 && submitRes.data) {
      setApplication(submitRes.data);
      navigate("/app/status");
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
    setSaveSuccess(false);
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
      setSaveSuccess(true);
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
    setSaveSuccess(false);
    setIsDeletingResume(true);

    const res = await deleteResume();
    if (res.status === 200 && res.data) {
      setApplication(res.data);
      setSaveSuccess(true);
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
      <div className="mx-auto max-w-md space-y-4 px-5 py-10 md:max-w-3xl">
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
      <div className="mx-auto max-w-md space-y-4 px-5 py-10 md:max-w-3xl">
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
    const stepDef = steps[currentStep];
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
        />
      );
    }

    const section = stepDef.id;
    const fields = grouped[section] ?? [];

    // Links section gets special handling for resume upload
    if (section === "links") {
      return (
        <SponsorInfoStep
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

  const handleBack = () => {
    if (currentStep === 0) {
      navigate("/app");
    } else {
      goToPreviousStep();
    }
  };

  return (
    <div className="mx-auto w-full max-w-md px-5 pt-4 pb-32 md:max-w-3xl md:px-8">
      <StepIndicator
        currentStep={currentStep}
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

        {saveSuccess && (
          <p className="mb-4 text-xs font-light text-[#09D082]">Saved</p>
        )}

        <FormProvider {...form}>
          <form onSubmit={(e) => e.preventDefault()}>
            {renderStep()}

            <StepNavigation
              currentStep={currentStep}
              onPrevious={goToPreviousStep}
              onNext={goToNextStep}
              onSubmit={submitApplication}
              isSaving={saving}
              isSubmitting={submitting}
              isResumeBusy={isResumeBusy}
              isLastStep={currentStep === steps.length - 1}
            />
          </form>
        </FormProvider>
      </div>
    </div>
  );
}
