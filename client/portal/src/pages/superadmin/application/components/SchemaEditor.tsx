import {
  ChevronDown,
  ChevronUp,
  Pencil,
  Trash2,
  TriangleAlert,
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

import type { SchemaStore } from "../createSchemaStore";
import { AddFieldDialog } from "./AddFieldDialog";
import { AddSectionDialog } from "./AddSectionDialog";
import { FieldCard } from "./FieldCard";

interface SchemaEditorProps {
  store: SchemaStore;
  description: string;
}

export function SchemaEditor({
  store: useStore,
  description,
}: SchemaEditorProps) {
  const fields = useStore((s) => s.fields);
  const sections = useStore((s) => s.sections);
  const contracts = useStore((s) => s.contracts);
  const warnings = useStore((s) => s.warnings);
  const updateField = useStore((s) => s.updateField);
  const removeField = useStore((s) => s.removeField);
  const moveField = useStore((s) => s.moveField);
  const removeSection = useStore((s) => s.removeSection);
  const renameSection = useStore((s) => s.renameSection);
  const moveSection = useStore((s) => s.moveSection);

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
      <p className="text-sm font-light text-muted-foreground">{description}</p>

      {/* Removing a field the backend reads is allowed — an event may not run
          travel reimbursement — but it must not happen silently. */}
      {warnings.length > 0 && (
        <div className="rounded-md border border-amber-200 bg-amber-50 p-3">
          <div className="flex items-center gap-2 text-amber-900">
            <TriangleAlert className="size-4 shrink-0" />
            <span className="text-sm font-medium">Saved with warnings</span>
          </div>
          <ul className="mt-1.5 space-y-1 pl-6 text-xs text-amber-900 list-disc">
            {warnings.map((warning) => (
              <li key={warning}>{warning}</li>
            ))}
          </ul>
        </div>
      )}

      <Accordion type="multiple" className="space-y-2">
        {fieldsBySection.map(
          ({ section, label, fields: sectionFields }, sectionIdx) => (
            <AccordionItem
              key={section}
              value={section}
              className="border rounded-md px-3 last:border-b"
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
                        availableFields={fields}
                        onUpdate={(updates) => updateField(field.id, updates)}
                        onRemove={() => removeField(field.id)}
                        onMove={(dir) => moveField(field.id, dir)}
                        isFirst={idx === 0}
                        isLast={idx === sectionFields.length - 1}
                        contract={contracts[field.id]}
                      />
                    ))
                  )}
                  <AddFieldDialog store={useStore} defaultSection={section} />
                </div>
              </AccordionContent>
            </AccordionItem>
          ),
        )}
      </Accordion>

      <AddSectionDialog store={useStore} />
    </div>
  );
}
