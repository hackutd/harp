import { useFormContext } from "react-hook-form";
import {
  FormField,
  FormItem,
  FormLabel,
  FormControl,
  FormMessage,
} from "@/components/ui/form";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { Pencil } from "lucide-react";
import type { ApplicationFormData } from "@/lib/validations/applicationSchema";
import {
  GENDER_OPTIONS,
  RACE_OPTIONS,
  ETHNICITY_OPTIONS,
  COUNTRY_OPTIONS,
  LEVEL_OF_STUDY_OPTIONS,
  EXPERIENCE_LEVEL_OPTIONS,
  SHIRT_SIZE_OPTIONS,
  DIETARY_RESTRICTION_OPTIONS,
  HEARD_ABOUT_OPTIONS,
} from "@/lib/validations/applicationSchema";
import type { ShortAnswerQuestion } from "@/types";

interface ReviewStepProps {
  onEditStep: (stepIndex: number) => void;
  userEmail?: string;
  questions: ShortAnswerQuestion[];
}

// Helper to get label from options
function getLabel(
  options: { value: string; label: string }[],
  value: string | undefined
): string {
  if (!value) return "Not provided";
  return options.find((o) => o.value === value)?.label || value;
}

function ReviewSection({
  title,
  stepIndex,
  onEdit,
  children,
}: {
  title: string;
  stepIndex: number;
  onEdit: (index: number) => void;
  children: React.ReactNode;
}) {
  return (
    <div className="border rounded-lg p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-semibold">{title}</h3>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => onEdit(stepIndex)}
        >
          <Pencil className="w-4 h-4 mr-1" />
          Edit
        </Button>
      </div>
      <div className="space-y-2 text-sm">{children}</div>
    </div>
  );
}

function ReviewField({ label, value }: { label: string; value: string }) {
  return (
    <div className="grid grid-cols-2 gap-2">
      <span className="text-muted-foreground">{label}</span>
      <span>{value || "Not provided"}</span>
    </div>
  );
}

export function ReviewStep({ onEditStep, userEmail, questions }: ReviewStepProps) {
  const form = useFormContext<ApplicationFormData>();
  const values = form.watch();

  const sortedQuestions = [...questions].sort(
    (a, b) => a.display_order - b.display_order
  );
  const responses = values.short_answer_responses || {};

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold">Review Your Application</h2>
        <p className="text-sm text-muted-foreground">
          Please review your answers before submitting
        </p>
      </div>

      {/* Personal Info */}
      <ReviewSection title="Personal Information" stepIndex={0} onEdit={onEditStep}>
        <ReviewField label="First Name" value={values.first_name} />
        <ReviewField label="Last Name" value={values.last_name} />
        {userEmail && <ReviewField label="Email" value={userEmail} />}
        <ReviewField label="Phone" value={values.phone_e164} />
        <ReviewField label="Age" value={values.age?.toString() || ""} />
        <ReviewField
          label="Country"
          value={getLabel(COUNTRY_OPTIONS, values.country_of_residence)}
        />
        <ReviewField label="Gender" value={getLabel(GENDER_OPTIONS, values.gender)} />
        <ReviewField label="Race" value={getLabel(RACE_OPTIONS, values.race)} />
        <ReviewField
          label="Ethnicity"
          value={getLabel(ETHNICITY_OPTIONS, values.ethnicity)}
        />
      </ReviewSection>

      {/* School Info */}
      <ReviewSection title="School Information" stepIndex={1} onEdit={onEditStep}>
        <ReviewField label="University" value={values.university} />
        <ReviewField label="Major" value={values.major} />
        <ReviewField
          label="Level of Study"
          value={getLabel(LEVEL_OF_STUDY_OPTIONS, values.level_of_study)}
        />
      </ReviewSection>

      {/* Experience */}
      <ReviewSection title="Hackathon Experience" stepIndex={2} onEdit={onEditStep}>
        <ReviewField
          label="Hackathons Attended"
          value={values.hackathons_attended_count?.toString() || "0"}
        />
        <ReviewField
          label="Experience Level"
          value={getLabel(EXPERIENCE_LEVEL_OPTIONS, values.software_experience_level)}
        />
        <ReviewField
          label="Heard About"
          value={getLabel(HEARD_ABOUT_OPTIONS, values.heard_about)}
        />
      </ReviewSection>

      {/* Short Answers */}
      <ReviewSection title="Short Answer Questions" stepIndex={3} onEdit={onEditStep}>
        <div className="space-y-3">
          {sortedQuestions.length === 0 ? (
            <p className="text-muted-foreground">No questions configured.</p>
          ) : (
            sortedQuestions.map((q) => (
              <div key={q.id}>
                <p className="text-muted-foreground text-xs mb-1">
                  {q.question} {q.required && "*"}
                </p>
                <p className="whitespace-pre-wrap">
                  {responses[q.id] || "Not provided"}
                </p>
              </div>
            ))
          )}
        </div>
      </ReviewSection>

      {/* Event Info */}
      <ReviewSection title="Event Information" stepIndex={4} onEdit={onEditStep}>
        <ReviewField
          label="Shirt Size"
          value={getLabel(SHIRT_SIZE_OPTIONS, values.shirt_size)}
        />
        <ReviewField
          label="Dietary Restrictions"
          value={
            values.dietary_restrictions?.length
              ? values.dietary_restrictions
                  .map((v) => getLabel(DIETARY_RESTRICTION_OPTIONS, v))
                  .join(", ")
              : "None"
          }
        />
        <ReviewField
          label="Accommodations"
          value={values.accommodations || "None"}
        />
      </ReviewSection>

      {/* Sponsor Info */}
      <ReviewSection title="Sponsor Information" stepIndex={5} onEdit={onEditStep}>
        <ReviewField label="GitHub" value={values.github || "Not provided"} />
        <ReviewField label="LinkedIn" value={values.linkedin || "Not provided"} />
        <ReviewField label="Website" value={values.website || "Not provided"} />
      </ReviewSection>

      {/* Acknowledgments */}
      <div className="border rounded-lg p-4 space-y-4">
        <h3 className="font-semibold">Agreements & Acknowledgments</h3>

        <FormField
          control={form.control}
          name="ack_application"
          render={({ field }) => (
            <FormItem className="flex flex-row items-start space-x-3 space-y-0">
              <FormControl>
                <Checkbox
                  checked={field.value}
                  onCheckedChange={field.onChange}
                />
              </FormControl>
              <div className="space-y-1 leading-none">
                <FormLabel className="font-normal">
                  <span className="font-medium">Disclaimer:</span> I understand
                  that this is an application and does not guarantee admission. *
                </FormLabel>
                <FormMessage />
              </div>
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="ack_mlh_coc"
          render={({ field }) => (
            <FormItem className="flex flex-row items-start space-x-3 space-y-0">
              <FormControl>
                <Checkbox
                  checked={field.value}
                  onCheckedChange={field.onChange}
                />
              </FormControl>
              <div className="space-y-1 leading-none">
                <FormLabel className="font-normal">
                  <span className="font-medium">Code of Conduct:</span> I have
                  read and agree to the{" "}
                  <a
                    href="https://static.mlh.io/docs/mlh-code-of-conduct.pdf"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-primary underline"
                  >
                    MLH Code of Conduct
                  </a>
                  . *
                </FormLabel>
                <FormMessage />
              </div>
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="ack_mlh_privacy"
          render={({ field }) => (
            <FormItem className="flex flex-row items-start space-x-3 space-y-0">
              <FormControl>
                <Checkbox
                  checked={field.value}
                  onCheckedChange={field.onChange}
                />
              </FormControl>
              <div className="space-y-1 leading-none">
                <FormLabel className="font-normal">
                  <span className="font-medium">Privacy Policy:</span> I
                  authorize you to share my application/registration information
                  with Major League Hacking for event administration, ranking,
                  and MLH administration in-line with the{" "}
                  <a
                    href="https://mlh.io/privacy"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-primary underline"
                  >
                    MLH Privacy Policy
                  </a>
                  . I further agree to the terms of both the{" "}
                  <a
                    href="https://github.com/MLH/mlh-policies/blob/main/contest-terms.md"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-primary underline"
                  >
                    MLH Contest Terms and Conditions
                  </a>{" "}
                  and the MLH Privacy Policy. *
                </FormLabel>
                <FormMessage />
              </div>
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="opt_in_mlh_emails"
          render={({ field }) => (
            <FormItem className="flex flex-row items-start space-x-3 space-y-0">
              <FormControl>
                <Checkbox
                  checked={field.value}
                  onCheckedChange={field.onChange}
                />
              </FormControl>
              <div className="space-y-1 leading-none">
                <FormLabel className="font-normal">
                  <span className="font-medium">Notifications (optional):</span>{" "}
                  I authorize MLH to send me occasional emails about relevant
                  events, career opportunities, and community announcements.
                </FormLabel>
              </div>
            </FormItem>
          )}
        />
      </div>
    </div>
  );
}
