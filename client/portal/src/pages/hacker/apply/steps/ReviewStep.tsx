import { Eye } from "lucide-react";
import { useFormContext } from "react-hook-form";

import {
  deriveSections,
  formatResponseValue,
  groupFieldsBySection,
  stripLabelLinks,
} from "@/shared/lib/schema-utils";
import type { ApplicationSchemaField } from "@/types";

import { ResumePreviewDialog } from "../components/ResumePreviewDialog";

interface ReviewStepProps {
  onEditStep: (stepIndex: number) => void;
  userEmail?: string;
  schema: ApplicationSchemaField[];
  hasResume: boolean;
  /** Map section id → step index so "Edit" buttons jump to the right step. */
  sectionStepMap: Record<string, number>;
  /** Section that hosts the resume uploader. */
  resumeSectionId?: string;
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
    <div className="rounded-lg border border-[#E5E5E5] p-4">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-sm font-medium text-black">{title}</h3>
        <button
          type="button"
          onClick={() => onEdit(stepIndex)}
          className="text-xs font-light text-[#8A8A8A] underline underline-offset-2 transition-colors hover:text-black"
        >
          Edit
        </button>
      </div>
      <div className="space-y-2.5">{children}</div>
    </div>
  );
}

function ReviewField({
  label,
  value,
  truncateLabel = false,
  stacked = false,
}: {
  label: string;
  value: string;
  /** Long labels (e.g. agreements) collapse to a single line with an ellipsis. */
  truncateLabel?: boolean;
  /** Long answers (e.g. short-answer questions) render below the question. */
  stacked?: boolean;
}) {
  if (stacked) {
    return (
      <div className="space-y-1">
        <span className="block text-xs font-light text-[#8A8A8A]">{label}</span>
        <p className="text-sm font-light break-words whitespace-pre-wrap text-black">
          {value || "Not provided"}
        </p>
      </div>
    );
  }

  return (
    <div className="flex items-baseline justify-between gap-4">
      <span
        title={truncateLabel ? label : undefined}
        className={
          truncateLabel
            ? "min-w-0 flex-1 truncate text-xs font-light text-[#8A8A8A]"
            : "shrink-0 text-xs font-light text-[#8A8A8A]"
        }
      >
        {label}
      </span>
      <span className="shrink-0 text-right text-sm font-light text-black">
        {value || "Not provided"}
      </span>
    </div>
  );
}

export function ReviewStep({
  onEditStep,
  userEmail,
  schema,
  hasResume,
  sectionStepMap,
  resumeSectionId,
}: ReviewStepProps) {
  const form = useFormContext();
  const values = form.watch();
  const sections = deriveSections(schema);
  const grouped = groupFieldsBySection(schema);

  return (
    <div className="space-y-7">
      <div className="space-y-1">
        <h1 className="text-3xl font-light tracking-tight text-black">
          Review
        </h1>
        <p className="text-sm font-light text-[#8A8A8A]">
          Check your answers before submitting
        </p>
      </div>

      <div className="space-y-4">
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
              {fields.map((field) => {
                const isAgreement = field.type === "checkbox";
                const isLongAnswer = field.type === "textarea";
                return (
                  <ReviewField
                    key={field.id}
                    label={
                      isAgreement ? stripLabelLinks(field.label) : field.label
                    }
                    value={formatResponseValue(values[field.id], field)}
                    truncateLabel={isAgreement}
                    stacked={isLongAnswer}
                  />
                );
              })}
              {sectionId === resumeSectionId && (
                <div className="flex items-baseline justify-between gap-4">
                  <span className="shrink-0 text-xs font-light text-[#8A8A8A]">
                    Resume
                  </span>
                  {hasResume ? (
                    <ResumePreviewDialog
                      trigger={
                        <button
                          type="button"
                          className="inline-flex shrink-0 items-center gap-1.5 text-sm font-light text-black underline underline-offset-2 transition-colors hover:text-[#8A8A8A]"
                        >
                          <Eye className="size-3.5" strokeWidth={1.5} />
                          View resume
                        </button>
                      }
                    />
                  ) : (
                    <span className="shrink-0 text-right text-sm font-light text-black">
                      Not provided
                    </span>
                  )}
                </div>
              )}
            </ReviewSection>
          );
        })}
      </div>
    </div>
  );
}
