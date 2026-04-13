import {
  ChevronDown,
  ChevronUp,
  Settings2,
  Trash2,
} from "lucide-react";
import { useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Collapsible,
  CollapsibleContent,
} from "@/components/ui/collapsible";
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

import { FIELD_TYPE_LABELS, TYPE_COLORS } from "../constants";
import { OptionsEditor } from "./OptionsEditor";

interface FieldCardProps {
  field: ApplicationSchemaField;
  onUpdate: (updates: Partial<ApplicationSchemaField>) => void;
  onRemove: () => void;
  onMove: (direction: "up" | "down") => void;
  isFirst: boolean;
  isLast: boolean;
}

const FIELD_TYPES: FieldType[] = [
  "text",
  "number",
  "textarea",
  "select",
  "multi_select",
  "checkbox",
  "phone",
];

export function FieldCard({
  field,
  onUpdate,
  onRemove,
  onMove,
  isFirst,
  isLast,
}: FieldCardProps) {
  const [detailsOpen, setDetailsOpen] = useState(false);
  const hasOptions = field.type === "select" || field.type === "multi_select";
  const hasValidation =
    field.validation && Object.keys(field.validation).length > 0;

  return (
    <div className="rounded-md border p-3 space-y-3">
      {/* Top row: type badge, label input, reorder, delete */}
      <div className="flex items-center gap-2">
        <Badge
          variant="outline"
          className={`text-[10px] shrink-0 ${TYPE_COLORS[field.type]}`}
        >
          {FIELD_TYPE_LABELS[field.type]}
        </Badge>
        <Input
          value={field.label}
          onChange={(e) => onUpdate({ label: e.target.value })}
          placeholder="Field label..."
          className="h-8 text-sm flex-1"
        />
        <div className="flex items-center shrink-0">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onMove("up")}
            disabled={isFirst}
            className="h-7 w-7 p-0 cursor-pointer"
          >
            <ChevronUp className="size-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onMove("down")}
            disabled={isLast}
            className="h-7 w-7 p-0 cursor-pointer"
          >
            <ChevronDown className="size-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={onRemove}
            className="h-7 w-7 p-0 text-muted-foreground hover:text-red-500 cursor-pointer"
          >
            <Trash2 className="size-3.5" />
          </Button>
        </div>
      </div>

      {/* Required toggle + details expand */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Switch
            id={`required-${field.id}`}
            checked={field.required}
            onCheckedChange={(checked) => onUpdate({ required: checked })}
            className="cursor-pointer"
          />
          <Label
            htmlFor={`required-${field.id}`}
            className="text-xs cursor-pointer"
          >
            Required
          </Label>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setDetailsOpen((prev) => !prev)}
          className="h-7 text-xs text-muted-foreground cursor-pointer gap-1"
        >
          <Settings2 className="size-3" />
          {detailsOpen ? "Hide" : "Details"}
        </Button>
      </div>

      {/* Expandable details */}
      <Collapsible open={detailsOpen} onOpenChange={setDetailsOpen}>
        <CollapsibleContent className="space-y-3 pt-1">
          {/* Type selector */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">
              Field Type
            </label>
            <Select
              value={field.type}
              onValueChange={(value: FieldType) => {
                const updates: Partial<ApplicationSchemaField> = {
                  type: value,
                };
                // Clear options if switching away from select types
                if (value !== "select" && value !== "multi_select") {
                  updates.options = undefined;
                }
                // Add empty options array if switching to select types
                if (
                  (value === "select" || value === "multi_select") &&
                  !field.options
                ) {
                  updates.options = [""];
                }
                onUpdate(updates);
              }}
            >
              <SelectTrigger className="h-8 text-sm cursor-pointer">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {FIELD_TYPES.map((type) => (
                  <SelectItem
                    key={type}
                    value={type}
                    className="cursor-pointer"
                  >
                    {FIELD_TYPE_LABELS[type]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Options editor for select types */}
          {hasOptions && (
            <OptionsEditor
              options={field.options ?? []}
              onChange={(options) => onUpdate({ options })}
            />
          )}

          {/* Validation fields */}
          {field.type === "textarea" && (
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">
                Max Length
              </label>
              <Input
                type="number"
                value={
                  (field.validation?.maxLength as number | undefined) ?? ""
                }
                onChange={(e) => {
                  const val = e.target.value
                    ? parseInt(e.target.value, 10)
                    : undefined;
                  onUpdate({
                    validation: val
                      ? { ...field.validation, maxLength: val }
                      : Object.fromEntries(
                          Object.entries(field.validation ?? {}).filter(
                            ([k]) => k !== "maxLength",
                          ),
                        ),
                  });
                }}
                placeholder="e.g. 1000"
                className="h-8 text-sm"
              />
            </div>
          )}

          {field.type === "number" && (
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground">
                  Min
                </label>
                <Input
                  type="number"
                  value={
                    (field.validation?.min as number | undefined) ?? ""
                  }
                  onChange={(e) => {
                    const val = e.target.value
                      ? parseInt(e.target.value, 10)
                      : undefined;
                    const next = { ...field.validation };
                    if (val !== undefined) next.min = val;
                    else delete next.min;
                    onUpdate({ validation: next });
                  }}
                  placeholder="Min"
                  className="h-8 text-sm"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground">
                  Max
                </label>
                <Input
                  type="number"
                  value={
                    (field.validation?.max as number | undefined) ?? ""
                  }
                  onChange={(e) => {
                    const val = e.target.value
                      ? parseInt(e.target.value, 10)
                      : undefined;
                    const next = { ...field.validation };
                    if (val !== undefined) next.max = val;
                    else delete next.max;
                    onUpdate({ validation: next });
                  }}
                  placeholder="Max"
                  className="h-8 text-sm"
                />
              </div>
            </div>
          )}

          {/* Show existing validation as read-only if type doesn't have dedicated editors */}
          {hasValidation &&
            field.type !== "textarea" &&
            field.type !== "number" && (
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground">
                  Validation
                </label>
                <p className="text-xs text-muted-foreground">
                  {JSON.stringify(field.validation)}
                </p>
              </div>
            )}
        </CollapsibleContent>
      </Collapsible>
    </div>
  );
}
