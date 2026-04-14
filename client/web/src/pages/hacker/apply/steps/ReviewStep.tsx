import { Pencil } from "lucide-react";
import { useFormContext } from "react-hook-form";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  deriveSections,
  formatResponseValue,
  groupFieldsBySection,
} from "@/shared/lib/schema-utils";
import type { ApplicationSchemaField } from "@/types";

interface ReviewStepProps {
  onEditStep: (stepIndex: number) => void;
  userEmail?: string;
  schema: ApplicationSchemaField[];
  hasResume: boolean;
  /** Map section id → step index so "Edit" buttons jump to the right step. */
  sectionStepMap: Record<string, number>;
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

export function ReviewStep({
  onEditStep,
  userEmail,
  schema,
  hasResume,
  sectionStepMap,
}: ReviewStepProps) {
  const form = useFormContext();
  const values = form.watch();
  const sections = deriveSections(schema);
  const grouped = groupFieldsBySection(schema);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold">Review Your Application</h2>
        <p className="text-sm text-muted-foreground">
          Please review your answers before submitting
        </p>
      </div>

      {sections.map(({ id: sectionId, label: sectionLabel }) => {
        const fields = grouped[sectionId];
        if (!fields || fields.length === 0) return null;
        const stepIndex = sectionStepMap[sectionId] ?? 0;

        return (
          <ReviewSection
            key={sectionId}
            title={sectionLabel}
            stepIndex={stepIndex}
            onEdit={onEditStep}
          >
            {sectionId === "personal" && userEmail && (
              <ReviewField label="Email" value={userEmail} />
            )}
            {fields.map((field) => (
              <ReviewField
                key={field.id}
                label={field.label}
                value={formatResponseValue(values[field.id], field)}
              />
            ))}
            {sectionId === "links" && (
              <ReviewField
                label="Resume"
                value={hasResume ? "Uploaded" : "Not provided"}
              />
            )}
          </ReviewSection>
        );
      })}

      {/* Acknowledgments */}
      <div className="border rounded-lg p-4 space-y-4">
        <h3 className="font-semibold">Agreements & Acknowledgments</h3>

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
