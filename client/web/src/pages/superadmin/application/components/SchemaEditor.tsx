import {
  ChevronDown,
  ChevronUp,
  Pencil,
  Trash2,
} from "lucide-react";
import { useState } from "react";

import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

import { useApplicationSchemaStore } from "../store";
import { AddFieldDialog } from "./AddFieldDialog";
import { AddSectionDialog } from "./AddSectionDialog";
import { FieldCard } from "./FieldCard";

export function SchemaEditor() {
  const fields = useApplicationSchemaStore((s) => s.fields);
  const sections = useApplicationSchemaStore((s) => s.sections);
  const updateField = useApplicationSchemaStore((s) => s.updateField);
  const removeField = useApplicationSchemaStore((s) => s.removeField);
  const moveField = useApplicationSchemaStore((s) => s.moveField);
  const removeSection = useApplicationSchemaStore((s) => s.removeSection);
  const renameSection = useApplicationSchemaStore((s) => s.renameSection);
  const moveSection = useApplicationSchemaStore((s) => s.moveSection);

  const [editingSectionId, setEditingSectionId] = useState<string | null>(null);
  const [editingLabel, setEditingLabel] = useState("");

  const fieldsBySection = sections.map((section) => ({
    section: section.id,
    label: section.label,
    fields: fields
      .filter((f) => f.section === section.id)
      .sort((a, b) => a.display_order - b.display_order),
  }));

  const startRename = (sectionId: string, currentLabel: string) => {
    setEditingSectionId(sectionId);
    setEditingLabel(currentLabel);
  };

  const commitRename = () => {
    if (editingSectionId && editingLabel.trim()) {
      renameSection(editingSectionId, editingLabel.trim());
    }
    setEditingSectionId(null);
    setEditingLabel("");
  };

  return (
    <div className="space-y-4">
      <p className="text-sm font-light text-muted-foreground">
        Configure the fields that appear on hacker applications. Fields are
        grouped by section.
      </p>

      <Accordion
        type="multiple"
        defaultValue={sections.map((s) => s.id)}
        className="space-y-2"
      >
        {fieldsBySection.map(
          ({ section, label, fields: sectionFields }, sectionIdx) => (
            <AccordionItem
              key={section}
              value={section}
              className="border rounded-md px-3"
            >
              <AccordionTrigger className="py-3 hover:no-underline cursor-pointer">
                <div className="flex items-center gap-2 flex-1 min-w-0">
                  {editingSectionId === section ? (
                    <Input
                      autoFocus
                      value={editingLabel}
                      onChange={(e) => setEditingLabel(e.target.value)}
                      onBlur={commitRename}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") commitRename();
                        if (e.key === "Escape") {
                          setEditingSectionId(null);
                          setEditingLabel("");
                        }
                      }}
                      onClick={(e) => e.stopPropagation()}
                      className="h-7 text-sm font-medium w-48"
                    />
                  ) : (
                    <span className="text-sm font-medium">{label}</span>
                  )}
                  <Badge variant="secondary" className="text-[10px] h-5">
                    {sectionFields.length}
                  </Badge>
                </div>
              </AccordionTrigger>
              <AccordionContent className="pb-3">
                <div className="space-y-2">
                  {/* Section action bar */}
                  <div className="flex items-center gap-1 pb-1">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 px-2 text-xs cursor-pointer"
                      onClick={() => startRename(section, label)}
                    >
                      <Pencil className="size-3 mr-1" />
                      Rename
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 px-2 text-xs cursor-pointer"
                      disabled={sectionIdx === 0}
                      onClick={() => moveSection(section, "up")}
                    >
                      <ChevronUp className="size-3 mr-1" />
                      Up
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 px-2 text-xs cursor-pointer"
                      disabled={sectionIdx === sections.length - 1}
                      onClick={() => moveSection(section, "down")}
                    >
                      <ChevronDown className="size-3 mr-1" />
                      Down
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 px-2 text-xs text-destructive hover:text-destructive cursor-pointer"
                      onClick={() => removeSection(section)}
                    >
                      <Trash2 className="size-3 mr-1" />
                      Delete Section
                    </Button>
                  </div>

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
          ),
        )}
      </Accordion>

      <AddSectionDialog />
    </div>
  );
}
