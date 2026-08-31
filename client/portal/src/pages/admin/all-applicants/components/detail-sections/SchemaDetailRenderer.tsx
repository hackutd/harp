import { Label } from "@/components/ui/label";
import { useRedactApplicants } from "@/shared/hooks";
import { isRedactedField } from "@/shared/lib/redaction";
import {
  deriveSections,
  formatResponseValue,
  getResponseValue,
  groupFieldsBySection,
  isFieldVisible,
} from "@/shared/lib/schema-utils";
import type { Application } from "@/types";

interface SchemaDetailRendererProps {
  application: Application;
  /** Sections to skip (e.g., "links" if rendered separately). */
  skipSections?: string[];
}

export function SchemaDetailRenderer({
  application,
  skipSections = [],
}: SchemaDetailRendererProps) {
  const redact = useRedactApplicants();
  const allFields = application.application_schema ?? [];
  // Admins grade blind: name, race, and ethnicity never reach the panel.
  const schema = redact
    ? allFields.filter((f) => !isRedactedField(f.id))
    : allFields;
  const responses = application.responses ?? {};
  const sections = deriveSections(schema);
  const grouped = groupFieldsBySection(schema);

  return (
    <>
      {sections
        .filter((s) => !skipSections.includes(s.id))
        .map((section) => {
          const fields = grouped[section.id]?.filter((f) =>
            isFieldVisible(f, responses),
          );
          if (!fields || fields.length === 0) return null;

          return (
            <div key={section.id}>
              <h4 className="text-sm font-semibold mb-2">{section.label}</h4>
              <div className="grid grid-cols-2 gap-3 text-sm">
                {fields.map((field) => {
                  const value = getResponseValue(responses, field.id, null);
                  // For links section fields (text type with URL-like values), render as links
                  if (
                    section.id === "links" &&
                    field.type === "text" &&
                    typeof value === "string" &&
                    value
                  ) {
                    return (
                      <div key={field.id} className="col-span-2">
                        <Label className="text-muted-foreground text-xs">
                          {field.label}
                        </Label>
                        <p>
                          <a
                            href={value}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-blue-600 hover:underline break-all cursor-pointer"
                          >
                            {value}
                          </a>
                        </p>
                      </div>
                    );
                  }

                  return (
                    <div key={field.id}>
                      <Label className="text-muted-foreground text-xs">
                        {field.label}
                      </Label>
                      <p>{formatResponseValue(value, field)}</p>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
    </>
  );
}
