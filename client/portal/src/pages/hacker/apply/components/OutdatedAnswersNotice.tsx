import {
  getObsoleteOptions,
  isFieldVisible,
  stripLabelLinks,
} from "@/shared/lib/schema-utils";
import type { ApplicationSchemaField } from "@/types";

export function OutdatedAnswersNotice({
  schema,
  values,
  onJumpToSection,
  onClear,
}: {
  schema: ApplicationSchemaField[];
  values: Record<string, unknown>;
  onJumpToSection: (id: string) => void;
  onClear: (field: ApplicationSchemaField) => void;
}) {
  const outdated = schema.filter(
    (field) => getObsoleteOptions(field, values[field.id]).length > 0,
  );
  if (!outdated.length) return null;

  return (
    <div
      role="status"
      className="mb-6 space-y-3 rounded-xl border border-[#E5E5E5] p-5"
    >
      <div className="space-y-1">
        <p className="text-sm font-normal">Some answer choices have changed</p>
        <p className="text-xs font-light text-[#8A8A8A]">
          You can keep saving your draft. Update these answers before
          submitting.
        </p>
      </div>
      <ul className="space-y-3">
        {outdated.map((field) => (
          <li key={field.id} className="space-y-1 text-sm font-light">
            <p>{stripLabelLinks(field.label)}</p>
            <p className="break-words text-xs text-[#8A8A8A]">
              No longer available:{" "}
              {getObsoleteOptions(field, values[field.id]).join(", ")}
            </p>
            <div className="flex flex-wrap gap-3 text-xs">
              {isFieldVisible(field, values) && (
                <button
                  type="button"
                  className="underline underline-offset-2"
                  onClick={() => onJumpToSection(field.section)}
                >
                  Go to section
                </button>
              )}
              <button
                type="button"
                className="text-[#8A8A8A] underline underline-offset-2 hover:text-black"
                onClick={() => onClear(field)}
              >
                Clear unavailable{" "}
                {field.type === "multi_select" ? "choices" : "answer"}
              </button>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
