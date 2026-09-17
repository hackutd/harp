import { ChevronDown, ChevronUp, Lock, Settings2, Trash2 } from "lucide-react";
import { useState } from "react";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent } from "@/components/ui/collapsible";
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
import { getFieldCondition } from "@/shared/lib/schema-utils";
import type { ApplicationSchemaField, FieldType } from "@/types";

import { FIELD_TYPE_LABELS, TYPE_COLORS } from "../constants";
import type { SchemaFieldContract } from "../contract";
import { OptionsEditor } from "./OptionsEditor";

interface FieldCardProps {
  field: ApplicationSchemaField;
  availableFields: ApplicationSchemaField[];
  onUpdate: (updates: Partial<ApplicationSchemaField>) => void;
  onRemove: () => void;
  onMove: (direction: "up" | "down") => void;
  isFirst: boolean;
  isLast: boolean;
  /** Set when the backend reads this field; its type and options are locked. */
  contract?: SchemaFieldContract;
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
  availableFields,
  onUpdate,
  onRemove,
  onMove,
  isFirst,
  isLast,
  contract,
}: FieldCardProps) {
  const [detailsOpen, setDetailsOpen] = useState(false);
  const hasOptions = field.type === "select" || field.type === "multi_select";
  const hasValidation =
    field.validation && Object.keys(field.validation).length > 0;
  const showCondition = getFieldCondition(field, "show_if");
  const requiredCondition = getFieldCondition(field, "required_if");
  const conditionControllers = availableFields.filter(
    (candidate) =>
      candidate.id !== field.id &&
      (candidate.type === "checkbox" || candidate.type === "select"),
  );
  const controller = conditionControllers.find(
    (candidate) => candidate.id === showCondition?.field,
  );

  const writeCondition = (
    controllerField: ApplicationSchemaField | undefined,
    expectedValue?: string,
  ) => {
    const next = { ...field.validation };
    if (!controllerField) {
      delete next.show_if;
      delete next.required_if;
    } else {
      const expression =
        controllerField.type === "select"
          ? `${controllerField.id}=${expectedValue ?? controllerField.options?.[0] ?? ""}`
          : controllerField.id;
      next.show_if = expression;
      if (requiredCondition) next.required_if = expression;
    }
    onUpdate({ validation: Object.keys(next).length > 0 ? next : undefined });
  };

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
        {contract && (
          <Badge
            variant="outline"
            className="text-[10px] shrink-0 bg-slate-100 text-slate-700 border-slate-200"
            title={`${contract.purpose} reads this field. Its type and options are locked.`}
          >
            <Lock className="size-2.5 mr-1" />
            System
          </Badge>
        )}
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
          {contract ? (
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 w-7 p-0 text-muted-foreground hover:text-red-500 cursor-pointer"
                >
                  <Trash2 className="size-3.5" />
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>
                    Delete &quot;{field.label}&quot;?
                  </AlertDialogTitle>
                  <AlertDialogDescription>
                    {contract.inactive_warning} Add the field back to turn it on
                    again.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel className="cursor-pointer">
                    Cancel
                  </AlertDialogCancel>
                  <AlertDialogAction
                    className="cursor-pointer"
                    onClick={onRemove}
                  >
                    Delete field
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          ) : (
            <Button
              variant="ghost"
              size="sm"
              onClick={onRemove}
              className="h-7 w-7 p-0 text-muted-foreground hover:text-red-500 cursor-pointer"
            >
              <Trash2 className="size-3.5" />
            </Button>
          )}
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
              disabled={!!contract}
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
              <SelectTrigger
                className="h-8 text-sm cursor-pointer"
                title={
                  contract
                    ? `${contract.purpose} needs this field to stay a ${FIELD_TYPE_LABELS[field.type]}.`
                    : undefined
                }
              >
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
              lockedOptions={contract?.required_options}
            />
          )}

          <div className="space-y-2 rounded-md border bg-muted/30 p-3">
            <div>
              <p className="text-xs font-medium">Conditional visibility</p>
              <p className="text-xs text-muted-foreground">
                Show this field only after a specific checkbox or select answer.
              </p>
            </div>
            <Select
              value={showCondition?.field ?? "always"}
              onValueChange={(value) => {
                const nextController = conditionControllers.find(
                  (candidate) => candidate.id === value,
                );
                writeCondition(nextController);
              }}
            >
              <SelectTrigger className="h-8 w-full text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="always">Always show this field</SelectItem>
                {conditionControllers.map((candidate) => (
                  <SelectItem key={candidate.id} value={candidate.id}>
                    After “{candidate.label}”
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {controller?.type === "select" && (
              <Select
                value={showCondition?.value ?? controller.options?.[0] ?? ""}
                onValueChange={(value) => writeCondition(controller, value)}
              >
                <SelectTrigger className="h-8 w-full text-sm">
                  <SelectValue placeholder="Choose the triggering answer" />
                </SelectTrigger>
                <SelectContent>
                  {(controller.options ?? []).map((option) => (
                    <SelectItem key={option} value={option}>
                      Answer is “{option}”
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
            {showCondition && (
              <div className="flex items-center justify-between gap-3 pt-1">
                <div>
                  <Label
                    htmlFor={`required-when-shown-${field.id}`}
                    className="text-xs"
                  >
                    Required when shown
                  </Label>
                  <p className="text-[11px] text-muted-foreground">
                    Enforce an answer only while this condition is active.
                  </p>
                </div>
                <Switch
                  id={`required-when-shown-${field.id}`}
                  checked={!!requiredCondition}
                  onCheckedChange={(checked) => {
                    const next = { ...field.validation };
                    if (checked) next.required_if = next.show_if;
                    else delete next.required_if;
                    onUpdate({ validation: next });
                  }}
                />
              </div>
            )}
            {conditionControllers.length === 0 && (
              <p className="text-[11px] text-muted-foreground">
                Add a checkbox or single-select field to create a condition.
              </p>
            )}
          </div>

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
                  value={(field.validation?.min as number | undefined) ?? ""}
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
                  value={(field.validation?.max as number | undefined) ?? ""}
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
