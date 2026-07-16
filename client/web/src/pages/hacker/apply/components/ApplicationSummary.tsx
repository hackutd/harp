import {
  deriveSections,
  formatResponseValue,
  groupFieldsBySection,
  stripLabelLinks,
} from "@/shared/lib/schema-utils";
import type { ApplicationSchemaField } from "@/types";

interface ApplicationSummaryProps {
  schema: ApplicationSchemaField[];
  responses: Record<string, unknown>;
  userEmail?: string;
  hasResume: boolean;
  /** Section that hosts the resume; defaults to "links". */
  resumeSectionId?: string;
}

function SummaryRow({
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
      <div className="space-y-1 py-2">
        <span className="block text-xs font-light text-[#8A8A8A]">{label}</span>
        <p className="text-sm font-light break-words whitespace-pre-wrap text-black">
          {value || "Not provided"}
        </p>
      </div>
    );
  }

  return (
    <div className="flex items-baseline justify-between gap-4 py-2">
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
      <span
        className={
          truncateLabel
            ? "shrink-0 text-right text-sm font-light text-black"
            : "text-right text-sm font-light break-words text-black"
        }
      >
        {value || "Not provided"}
      </span>
    </div>
  );
}

/**
 * Read-only summary of a submitted application, grouped by schema section.
 * Standalone (no form context), so it works on the status page and the
 * submitted-application view.
 */
export function ApplicationSummary({
  schema,
  responses,
  userEmail,
  hasResume,
  resumeSectionId = "links",
}: ApplicationSummaryProps) {
  const sections = deriveSections(schema);
  const grouped = groupFieldsBySection(schema);

  return (
    <div className="space-y-4">
      {sections.map(({ id: sectionId, label: sectionLabel }) => {
        const fields = grouped[sectionId];
        if (!fields || fields.length === 0) return null;

        return (
          <div
            key={sectionId}
            className="rounded-xl border border-[#E5E5E5] p-4"
          >
            <h3 className="mb-2 text-sm font-medium text-black">
              {sectionLabel}
            </h3>
            <div className="divide-y divide-[#F5F5F5]">
              {sectionId === "personal" && userEmail && (
                <SummaryRow label="Email" value={userEmail} />
              )}
              {fields.map((field) => (
                <SummaryRow
                  key={field.id}
                  label={stripLabelLinks(field.label)}
                  value={formatResponseValue(responses[field.id], field)}
                  truncateLabel={field.type === "checkbox"}
                  stacked={field.type === "textarea"}
                />
              ))}
              {sectionId === resumeSectionId && (
                <SummaryRow
                  label="Resume"
                  value={hasResume ? "Uploaded" : "Not provided"}
                />
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
