import { Plus } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import type { ApplicationSchemaField, FieldType } from "@/types";

import { FIELD_TYPE_LABELS } from "../constants";
import { useApplicationSchemaStore } from "../store";
import { OptionsEditor } from "./OptionsEditor";

const FIELD_TYPES: FieldType[] = [
  "text",
  "number",
  "textarea",
  "select",
  "multi_select",
  "checkbox",
  "phone",
];

interface AddFieldDialogProps {
  defaultSection?: string;
}

export function AddFieldDialog({ defaultSection }: AddFieldDialogProps) {
  const [open, setOpen] = useState(false);
  const [section, setSection] = useState(defaultSection ?? "");
  const [type, setType] = useState<FieldType>("text");
  const [label, setLabel] = useState("");
  const [required, setRequired] = useState(false);
  const [options, setOptions] = useState<string[]>([""]);

  const fields = useApplicationSchemaStore((s) => s.fields);
  const sections = useApplicationSchemaStore((s) => s.sections);
  const addField = useApplicationSchemaStore((s) => s.addField);

  const hasOptions = type === "select" || type === "multi_select";

  const reset = () => {
    setSection(defaultSection ?? sections[0]?.id ?? "");
    setType("text");
    setLabel("");
    setRequired(false);
    setOptions([""]);
  };

  const handleAdd = () => {
    if (!label.trim()) return;

    const sectionFields = fields.filter((f) => f.section === section);
    const maxOrder = sectionFields.reduce(
      (max, f) => Math.max(max, f.display_order),
      0,
    );

    const sectionDef = sections.find((s) => s.id === section);

    const field: ApplicationSchemaField = {
      id: `field_${Date.now()}`,
      type,
      label: label.trim(),
      required,
      section,
      section_label: sectionDef?.label,
      display_order: maxOrder + 1,
      ...(hasOptions ? { options: options.filter((o) => o.trim()) } : {}),
    };

    addField(field);
    reset();
    setOpen(false);
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        setOpen(v);
        if (v) reset();
      }}
    >
      <DialogTrigger asChild>
        <Button
          variant="outline"
          className="w-full border-dashed cursor-pointer"
        >
          <Plus className="size-4 mr-2" />
          Add Field
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Add Field</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          {/* Section */}
          <div className="space-y-1.5">
            <Label className="text-sm">Section</Label>
            <Select value={section} onValueChange={setSection}>
              <SelectTrigger className="cursor-pointer">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {sections.map((s) => (
                  <SelectItem key={s.id} value={s.id} className="cursor-pointer">
                    {s.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Type */}
          <div className="space-y-1.5">
            <Label className="text-sm">Field Type</Label>
            <Select
              value={type}
              onValueChange={(v: FieldType) => setType(v)}
            >
              <SelectTrigger className="cursor-pointer">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {FIELD_TYPES.map((t) => (
                  <SelectItem key={t} value={t} className="cursor-pointer">
                    {FIELD_TYPE_LABELS[t]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Label */}
          <div className="space-y-1.5">
            <Label className="text-sm">Label</Label>
            <Input
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="e.g. Favorite programming language"
            />
          </div>

          {/* Required */}
          <div className="flex items-center gap-2">
            <Switch
              checked={required}
              onCheckedChange={setRequired}
              className="cursor-pointer"
            />
            <Label className="text-sm cursor-pointer">Required</Label>
          </div>

          {/* Options for select types */}
          {hasOptions && (
            <OptionsEditor options={options} onChange={setOptions} />
          )}
        </div>
        <DialogFooter>
          <Button
            onClick={handleAdd}
            disabled={!label.trim()}
            className="cursor-pointer"
          >
            Add Field
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
