import {
  deriveSections,
  formatResponseValue,
  groupFieldsBySection,
  isFieldVisible,
  stripLabelLinks,
} from "@/shared/lib/schema-utils";
import { cn } from "@/shared/lib/utils";
import type { ApplicationSchemaField } from "@/types";

interface ApplicationSummaryProps {
  schema: ApplicationSchemaField[];
  responses: Record<string, unknown>;
  userEmail?: string;
  hasResume: boolean;
  /** Section that hosts the resume; defaults to "links". Pass null to omit the resume row (e.g. RSVP schemas). */
  resumeSectionId?: string | null;
  cardClassName?: string;
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
        <span className="block text-xs font-light text-ink/65">{label}</span>
        <p className="text-sm font-light break-words whitespace-pre-wrap text-ink">
          {value || "Not provided"}
        </p>
      </div>
    );
  }

  // flex-wrap keeps a short question and its answer on one line, and drops the
  // answer onto its own right-aligned line when the pair is too wide for the
  // screen. Without it a long question sets the row's width and the whole page
  // scrolls sideways on a phone.
  return (
    <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 py-2">
      <span
        title={truncateLabel ? label : undefined}
        className={
          truncateLabel
            ? "min-w-0 flex-1 truncate text-xs font-light text-ink/65"
            : "max-w-full text-xs font-light break-words text-ink/65"
        }
      >
        {label}
      </span>
      <span
        className={
          truncateLabel
            ? "shrink-0 text-right text-sm font-light text-ink"
            : "ml-auto max-w-full text-right text-sm font-light break-words text-ink"
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
  cardClassName,
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
            className={cn("rounded-xl border border-ink/10 p-4", cardClassName)}
          >
            <h3 className="mb-2 text-sm font-medium text-ink">
              {sectionLabel}
            </h3>
            <div className="divide-y divide-ink/10">
              {sectionId === "personal" && userEmail && (
                <SummaryRow label="Email" value={userEmail} />
              )}
              {fields.map((field) =>
                isFieldVisible(field, responses) ? (
                  <SummaryRow
                    key={field.id}
                    label={stripLabelLinks(field.label)}
                    value={formatResponseValue(responses[field.id], field)}
                    truncateLabel={field.type === "checkbox"}
                    stacked={field.type === "textarea"}
                  />
                ) : null,
              )}
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
