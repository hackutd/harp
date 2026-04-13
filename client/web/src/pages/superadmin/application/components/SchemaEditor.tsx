import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Badge } from "@/components/ui/badge";

import { SECTION_LABELS, SECTION_ORDER } from "../constants";
import { useApplicationSchemaStore } from "../store";
import { AddFieldDialog } from "./AddFieldDialog";
import { FieldCard } from "./FieldCard";

export function SchemaEditor() {
  const fields = useApplicationSchemaStore((s) => s.fields);
  const updateField = useApplicationSchemaStore((s) => s.updateField);
  const removeField = useApplicationSchemaStore((s) => s.removeField);
  const moveField = useApplicationSchemaStore((s) => s.moveField);

  const fieldsBySection = SECTION_ORDER.map((section) => ({
    section,
    label: SECTION_LABELS[section],
    fields: fields
      .filter((f) => f.section === section)
      .sort((a, b) => a.display_order - b.display_order),
  }));

  return (
    <div className="space-y-4">
      <p className="text-sm font-light text-muted-foreground">
        Configure the fields that appear on hacker applications. Fields are
        grouped by section.
      </p>

      <Accordion
        type="multiple"
        defaultValue={SECTION_ORDER}
        className="space-y-2"
      >
        {fieldsBySection.map(({ section, label, fields: sectionFields }) => (
          <AccordionItem
            key={section}
            value={section}
            className="border rounded-md px-3"
          >
            <AccordionTrigger className="py-3 hover:no-underline cursor-pointer">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium">{label}</span>
                <Badge variant="secondary" className="text-[10px] h-5">
                  {sectionFields.length}
                </Badge>
              </div>
            </AccordionTrigger>
            <AccordionContent className="pb-3">
              <div className="space-y-2">
                {sectionFields.length === 0 ? (
                  <p className="text-xs text-muted-foreground italic py-2">
                    No fields in this section.
                  </p>
                ) : (
                  sectionFields.map((field, idx) => (
                    <FieldCard
                      key={field.id}
                      field={field}
                      onUpdate={(updates) => updateField(field.id, updates)}
                      onRemove={() => removeField(field.id)}
                      onMove={(dir) => moveField(field.id, dir)}
                      isFirst={idx === 0}
                      isLast={idx === sectionFields.length - 1}
                    />
                  ))
                )}
                <AddFieldDialog defaultSection={section} />
              </div>
            </AccordionContent>
          </AccordionItem>
        ))}
      </Accordion>
    </div>
  );
}
