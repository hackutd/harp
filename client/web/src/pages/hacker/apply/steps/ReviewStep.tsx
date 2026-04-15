import { Pencil } from "lucide-react";
import { useFormContext } from "react-hook-form";

import { Button } from "@/components/ui/button";
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
    </div>
  );
}
