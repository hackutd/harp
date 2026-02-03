import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useForm, FormProvider } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { AlertCircle } from "lucide-react";
import { StepIndicator } from "./StepIndicator";
import { StepNavigation } from "./StepNavigation";
import { PersonalInfoStep } from "./steps/PersonalInfoStep";
import { SchoolInfoStep } from "./steps/SchoolInfoStep";
import { ExperienceStep } from "./steps/ExperienceStep";
import { ShortAnswerStep } from "./steps/ShortAnswerStep";
import { EventInfoStep } from "./steps/EventInfoStep";
import { SponsorInfoStep } from "./steps/SponsorInfoStep";
import { ReviewStep } from "./steps/ReviewStep";
import type { ApplicationFormData } from "@/lib/validations/applicationSchema";
import {
  applicationSchema,
  STEP_FIELDS,
} from "@/lib/validations/applicationSchema";
import { getRequest, patchRequest, postRequest, errorAlert } from "@/lib/api";
import type { Application, ShortAnswerQuestion } from "@/types";

interface ApplicationWizardProps {
  userEmail?: string;
}

const STEPS = [
  { id: "personal", title: "Personal Info" },
  { id: "school", title: "School Info" },
  { id: "experience", title: "Experience" },
  { id: "short-answer", title: "Short Answers" },
  { id: "event", title: "Event Info" },
  { id: "sponsor", title: "Sponsor Info" },
  { id: "review", title: "Review" },
];

// Dietary restriction enum type
type DietaryRestriction =
  | "vegan"
  | "vegetarian"
  | "halal"
  | "nuts"
  | "fish"
  | "wheat"
  | "dairy"
  | "eggs"
  | "no_beef"
  | "no_pork";

// Default form values
const defaultValues: ApplicationFormData = {
  first_name: "",
  last_name: "",
  phone_e164: "",
  age: 0,
  country_of_residence: "",
  gender: "",
  race: "",
  ethnicity: "",
  university: "",
  major: "",
  level_of_study: "",
  hackathons_attended_count: 0,
  software_experience_level: "",
  heard_about: "",
  short_answer_responses: {},
  shirt_size: "",
  dietary_restrictions: [] as DietaryRestriction[],
  accommodations: "",
  github: "",
  linkedin: "",
  website: "",
  ack_application: false,
  ack_mlh_coc: false,
  ack_mlh_privacy: false,
  opt_in_mlh_emails: false,
};

// Transform API response to form data
function transformApplicationToFormData(app: Application): ApplicationFormData {
  return {
    first_name: app.first_name ?? "",
    last_name: app.last_name ?? "",
    phone_e164: app.phone_e164 ?? "",
    age: app.age ?? 0,
    country_of_residence: app.country_of_residence ?? "",
    gender: app.gender ?? "",
    race: app.race ?? "",
    ethnicity: app.ethnicity ?? "",
    university: app.university ?? "",
    major: app.major ?? "",
    level_of_study: app.level_of_study ?? "",
    hackathons_attended_count: app.hackathons_attended_count ?? 0,
    software_experience_level: app.software_experience_level ?? "",
    heard_about: app.heard_about ?? "",
    short_answer_responses: app.short_answer_responses ?? {},
    shirt_size: app.shirt_size ?? "",
    dietary_restrictions: (app.dietary_restrictions ?? []) as DietaryRestriction[],
    accommodations: app.accommodations ?? "",
    github: app.github ?? "",
    linkedin: app.linkedin ?? "",
    website: app.website ?? "",
    ack_application: app.ack_application ?? false,
    ack_mlh_coc: app.ack_mlh_coc ?? false,
    ack_mlh_privacy: app.ack_mlh_privacy ?? false,
    opt_in_mlh_emails: app.opt_in_mlh_emails ?? false,
  };
}

// Transform form data to API payload
// Using Record<string, unknown> because react-hook-form with zod coerce types as unknown
function transformFormDataToPayload(
  data: Record<string, unknown>
): Record<string, unknown> {
  const payload: Record<string, unknown> = {};

  // String fields - only include if non-empty
  const stringFields = [
    "first_name",
    "last_name",
    "phone_e164",
    "country_of_residence",
    "gender",
    "race",
    "ethnicity",
    "university",
    "major",
    "level_of_study",
    "software_experience_level",
    "heard_about",
    "shirt_size",
    "accommodations",
    "github",
    "linkedin",
    "website",
  ];

  for (const field of stringFields) {
    const value = data[field];
    if (value !== undefined && value !== "") {
      payload[field] = value;
    }
  }

  // Number fields
  const age = data.age as number | undefined;
  if (age !== undefined && !isNaN(age)) {
    payload.age = age;
  }
  const hackathonsCount = data.hackathons_attended_count as number | undefined;
  if (hackathonsCount !== undefined) {
    payload.hackathons_attended_count = hackathonsCount;
  }

  // Array field
  payload.dietary_restrictions = data.dietary_restrictions || [];

  // Short answer responses
  payload.short_answer_responses = data.short_answer_responses || {};

  // Boolean fields
  payload.ack_application = data.ack_application;
  payload.ack_mlh_coc = data.ack_mlh_coc;
  payload.ack_mlh_privacy = data.ack_mlh_privacy;
  payload.opt_in_mlh_emails = data.opt_in_mlh_emails;

  return payload;
}

export function ApplicationWizard({ userEmail }: ApplicationWizardProps) {
  const navigate = useNavigate();
  const [currentStep, setCurrentStep] = useState(0);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [application, setApplication] = useState<Application | null>(null);
  const [questions, setQuestions] = useState<ShortAnswerQuestion[]>([]);
  const [apiError, setApiError] = useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = useState(false);

  const form = useForm({
    resolver: zodResolver(applicationSchema),
    defaultValues,
    mode: "onTouched",
  });

  // Load existing application data
  useEffect(() => {
    const loadApplication = async () => {
      const res = await getRequest<Application>(
        "/v1/applications/me",
        "application"
      );
      if (res.status === 200 && res.data) {
        setApplication(res.data);
        if (res.data.short_answer_questions) {
          setQuestions(res.data.short_answer_questions);
        }
        const formData = transformApplicationToFormData(res.data);
        form.reset({ ...defaultValues, ...formData });
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

  // Validate current step fields
  const validateCurrentStep = async (): Promise<boolean> => {
    const fields = STEP_FIELDS[currentStep];
    const result = await form.trigger(fields);
    return result;
  };

  // Navigate to next step
  const goToNextStep = async () => {
    setApiError(null);
    const isValid = await validateCurrentStep();
    if (isValid) {
      setCurrentStep((prev) => Math.min(prev + 1, STEPS.length - 1));
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  };

  // Navigate to previous step
  const goToPreviousStep = () => {
    setApiError(null);
    setCurrentStep((prev) => Math.max(prev - 1, 0));
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  // Jump to specific step (from review page)
  const goToStep = (stepIndex: number) => {
    setApiError(null);
    setCurrentStep(stepIndex);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  // Save draft
  const saveDraft = async () => {
    setSaving(true);
    setApiError(null);
    setSaveSuccess(false);

    const formData = form.getValues();
    const payload = transformFormDataToPayload(formData);

    const res = await patchRequest<Application>(
      "/v1/applications/me",
      payload,
      "application"
    );

    if (res.status === 200 && res.data) {
      setApplication(res.data);
      setSaveSuccess(true);
    } else {
      setApiError(res.error || "Failed to save progress");
      errorAlert(res);
    }
    setSaving(false);
  };

  // Submit application
  const submitApplication = async () => {
    setSubmitting(true);
    setApiError(null);

    // First validate all fields
    const isValid = await form.trigger();
    if (!isValid) {
      setApiError("Please complete all required fields before submitting");
      setSubmitting(false);
      return;
    }

    // Validate required short answer questions
    const responses = form.getValues("short_answer_responses") || {};
    const missingQuestions: string[] = [];
    for (const q of questions) {
      if (q.required && (!responses[q.id] || !responses[q.id].trim())) {
        missingQuestions.push(q.question);
      }
    }
    if (missingQuestions.length > 0) {
      setApiError(
        `Please answer the following required questions: ${missingQuestions.join(", ")}`
      );
      setSubmitting(false);
      return;
    }

    // Save current state first
    const formData = form.getValues();
    const payload = transformFormDataToPayload(formData);

    const saveRes = await patchRequest<Application>(
      "/v1/applications/me",
      payload,
      "application"
    );

    if (saveRes.status !== 200) {
      setApiError(saveRes.error || "Failed to save before submitting");
      errorAlert(saveRes);
      setSubmitting(false);
      return;
    }

    // Now submit
    const submitRes = await postRequest<Application>(
      "/v1/applications/me/submit",
      {},
      "application"
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

  // Loading state
  if (loading) {
    return (
      <Card>
        <CardContent className="py-12">
          <div className="flex flex-col items-center justify-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
            <p className="mt-4 text-muted-foreground">
              Loading your application...
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Read-only mode if application is already submitted
  if (application && application.status !== "draft") {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Application Submitted</CardTitle>
          <CardDescription>
            Your application has been submitted and cannot be edited.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Status: {application.status}</AlertTitle>
            <AlertDescription>
              {application.status === "submitted" &&
                "Your application is being reviewed."}
              {application.status === "accepted" &&
                "Congratulations! Your application has been accepted."}
              {application.status === "rejected" &&
                "Unfortunately, your application was not accepted."}
              {application.status === "waitlisted" &&
                "You have been placed on the waitlist."}
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    );
  }

  // Render current step
  const renderStep = () => {
    switch (currentStep) {
      case 0:
        return <PersonalInfoStep userEmail={userEmail} />;
      case 1:
        return <SchoolInfoStep />;
      case 2:
        return <ExperienceStep />;
      case 3:
        return <ShortAnswerStep questions={questions} />;
      case 4:
        return <EventInfoStep />;
      case 5:
        return <SponsorInfoStep />;
      case 6:
        return <ReviewStep onEditStep={goToStep} userEmail={userEmail} questions={questions} />;
      default:
        return null;
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Hacker Application</CardTitle>
        <CardDescription>
          Complete your application to participate in the hackathon
        </CardDescription>
        <div className="pt-4">
          <StepIndicator
            steps={STEPS}
            currentStep={currentStep}
            onStepClick={goToStep}
          />
        </div>
      </CardHeader>

      <CardContent>
        {/* Error alert */}
        {apiError && (
          <Alert variant="destructive" className="mb-6">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Error</AlertTitle>
            <AlertDescription>{apiError}</AlertDescription>
          </Alert>
        )}

        {/* Success message */}
        {saveSuccess && (
          <Alert className="mb-6 border-green-500 text-green-700">
            <AlertTitle>Saved!</AlertTitle>
            <AlertDescription>Your progress has been saved.</AlertDescription>
          </Alert>
        )} 

        <FormProvider {...form}>
          <form onSubmit={(e) => e.preventDefault()}>
            {renderStep()}

            <StepNavigation
              currentStep={currentStep}
              onPrevious={goToPreviousStep}
              onNext={goToNextStep}
              onSave={saveDraft}
              onSubmit={submitApplication}
              isSaving={saving}
              isSubmitting={submitting}
              isLastStep={currentStep === STEPS.length - 1}
            />
          </form>
        </FormProvider>
      </CardContent>
    </Card>
  );
}
