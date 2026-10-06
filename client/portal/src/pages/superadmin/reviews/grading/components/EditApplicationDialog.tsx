import { FileText, Trash2, Upload } from "lucide-react";
import { type ChangeEvent, memo, useRef, useState } from "react";

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
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
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
import { Textarea } from "@/components/ui/textarea";
import { MAX_RESUME_SIZE_BYTES } from "@/pages/hacker/apply/api";
import {
  deriveSections,
  groupFieldsBySection,
} from "@/shared/lib/schema-utils";
import type { Application, ApplicationSchemaField } from "@/types";

import { buildResponsesPatch } from "../utils";

/** Radix Select can't hold an empty value, so "no answer" gets a sentinel. */
const NO_ANSWER = "__no_answer__";

interface FieldEditorProps {
  field: ApplicationSchemaField;
  value: unknown;
  disabled: boolean;
  onChange: (value: unknown) => void;
}

function FieldEditor({ field, value, disabled, onChange }: FieldEditorProps) {
  const id = `edit-${field.id}`;

  switch (field.type) {
    case "textarea":
      return (
        <Textarea
          id={id}
          value={typeof value === "string" ? value : ""}
          disabled={disabled}
          onChange={(e) => onChange(e.target.value)}
          rows={4}
        />
      );

    case "number":
      return (
        <Input
          id={id}
          type="number"
          value={typeof value === "number" ? value : ""}
          disabled={disabled}
          onChange={(e) =>
            onChange(e.target.value === "" ? null : Number(e.target.value))
          }
        />
      );

    case "select": {
      const current = typeof value === "string" && value !== "" ? value : null;
      // Keep an answer the schema no longer offers selectable, so opening the
      // editor never silently changes it.
      const options =
        current && !field.options?.includes(current)
          ? [...(field.options ?? []), current]
          : (field.options ?? []);
      return (
        <Select
          value={current ?? NO_ANSWER}
          disabled={disabled}
          onValueChange={(v) => onChange(v === NO_ANSWER ? null : v)}
        >
          <SelectTrigger id={id} className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={NO_ANSWER}>
              <span className="text-muted-foreground">No answer</span>
            </SelectItem>
            {options.map((option) => (
              <SelectItem key={option} value={option}>
                {option}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      );
    }

    case "multi_select": {
      const selected = Array.isArray(value)
        ? value.filter((v): v is string => typeof v === "string")
        : [];
      const options = [
        ...(field.options ?? []),
        ...selected.filter((v) => !field.options?.includes(v)),
      ];
      return (
        <div className="grid gap-2 sm:grid-cols-2">
          {options.map((option) => (
            <label
              key={option}
              className="flex items-center gap-2 text-sm cursor-pointer"
            >
              <Checkbox
                checked={selected.includes(option)}
                disabled={disabled}
                onCheckedChange={(checked) =>
                  onChange(
                    checked
                      ? [...selected, option]
                      : selected.filter((v) => v !== option),
                  )
                }
              />
              {option}
            </label>
          ))}
        </div>
      );
    }

    case "checkbox":
      return (
        <label className="flex items-center gap-2 text-sm cursor-pointer">
          <Checkbox
            id={id}
            checked={value === true}
            disabled={disabled}
            onCheckedChange={(checked) => onChange(checked === true)}
          />
          Checked
        </label>
      );

    default:
      return (
        <Input
          id={id}
          type={field.type === "phone" ? "tel" : "text"}
          value={typeof value === "string" ? value : ""}
          disabled={disabled}
          onChange={(e) => onChange(e.target.value)}
        />
      );
  }
}

interface ResumeEditorProps {
  hasResume: boolean;
  disabled: boolean;
  onReplace: (file: File) => void;
  onRemove: () => void;
}

function ResumeEditor({
  hasResume,
  disabled,
  onReplace,
  onRemove,
}: ResumeEditorProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);

  const handleFile = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;

    const isPDF =
      file.type === "application/pdf" ||
      file.name.toLowerCase().trim().endsWith(".pdf");
    if (!isPDF) {
      setError("Resume must be a PDF file.");
      return;
    }
    if (file.size > MAX_RESUME_SIZE_BYTES) {
      setError(
        `Resume must be ${MAX_RESUME_SIZE_BYTES / 1024 / 1024} MB or smaller.`,
      );
      return;
    }
    setError(null);
    onReplace(file);
  };

  return (
    <div className="rounded-lg border p-3">
      <div className="flex flex-wrap items-center gap-2">
        <FileText className="h-4 w-4 text-muted-foreground" />
        <span className="text-sm">
          {hasResume ? "Resume on file" : "No resume uploaded"}
        </span>
        <div className="ml-auto flex gap-2">
          <input
            ref={inputRef}
            type="file"
            accept="application/pdf,.pdf"
            className="hidden"
            aria-label="Resume PDF"
            onChange={handleFile}
          />
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="cursor-pointer"
            disabled={disabled}
            onClick={() => inputRef.current?.click()}
          >
            <Upload className="h-3.5 w-3.5" />
            {hasResume ? "Replace PDF" : "Upload PDF"}
          </Button>
          {hasResume && (
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  className="cursor-pointer text-destructive"
                  disabled={disabled}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  Remove
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Remove this resume?</AlertDialogTitle>
                  <AlertDialogDescription>
                    The file is deleted from storage. This cannot be undone.
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
                    Remove resume
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          )}
        </div>
      </div>
      <p className="mt-2 text-xs text-muted-foreground">
        Resume changes save immediately and replace the hacker&apos;s file.
      </p>
      {error && (
        <p className="mt-1 text-sm text-destructive" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}

interface EditApplicationFormProps {
  application: Application;
  saving: boolean;
  onSave: (responses: Record<string, unknown>) => Promise<boolean>;
  onReplaceResume: (file: File) => void;
  onRemoveResume: () => void;
  onDone: () => void;
}

function EditApplicationForm({
  application,
  saving,
  onSave,
  onReplaceResume,
  onRemoveResume,
  onDone,
}: EditApplicationFormProps) {
  const original = application.responses ?? {};
  const [values, setValues] = useState<Record<string, unknown>>(original);

  const schema = application.application_schema ?? [];
  const sections = deriveSections(schema);
  const grouped = groupFieldsBySection(schema);
  const patch = buildResponsesPatch(original, values);
  const changedCount = Object.keys(patch).length;

  const handleSave = async () => {
    if (changedCount === 0) {
      onDone();
      return;
    }
    if (await onSave(patch)) onDone();
  };

  return (
    <>
      <div className="-mx-6 min-h-0 flex-1 space-y-8 overflow-y-auto px-6">
        <section className="space-y-2">
          <h3 className="text-sm font-semibold">Resume</h3>
          <ResumeEditor
            hasResume={application.resume_path != null}
            disabled={saving}
            onReplace={onReplaceResume}
            onRemove={onRemoveResume}
          />
        </section>

        {sections.map((section) => (
          <section key={section.id} className="space-y-4">
            <h3 className="text-sm font-semibold">{section.label}</h3>
            {(grouped[section.id] ?? []).map((field) => (
              <div key={field.id} className="space-y-1.5">
                <Label
                  htmlFor={`edit-${field.id}`}
                  className="text-xs text-muted-foreground"
                >
                  {field.label}
                  {field.id in patch && (
                    <span className="ml-1 text-foreground">· edited</span>
                  )}
                </Label>
                <FieldEditor
                  field={field}
                  value={values[field.id]}
                  disabled={saving}
                  onChange={(value) =>
                    setValues((prev) => ({ ...prev, [field.id]: value }))
                  }
                />
              </div>
            ))}
          </section>
        ))}

        {schema.length === 0 && (
          <p className="text-sm text-muted-foreground">
            The application form has no questions to edit.
          </p>
        )}
      </div>

      <DialogFooter>
        <Button
          variant="outline"
          className="cursor-pointer"
          disabled={saving}
          onClick={onDone}
        >
          Cancel
        </Button>
        <Button
          className="cursor-pointer"
          disabled={saving || changedCount === 0}
          onClick={handleSave}
        >
          {changedCount > 1
            ? `Save ${changedCount} changes`
            : changedCount === 1
              ? "Save 1 change"
              : "Save"}
        </Button>
      </DialogFooter>
    </>
  );
}

interface EditApplicationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  application: Application | null;
  saving: boolean;
  onSave: (responses: Record<string, unknown>) => Promise<boolean>;
  onReplaceResume: (file: File) => void;
  onRemoveResume: () => void;
}

/**
 * Super admin editor for any hacker's answers and resume, in any status.
 * Answers are only type-checked, so a super admin can save an incomplete
 * application — required answers are the hacker's job at submit.
 */
export const EditApplicationDialog = memo(function EditApplicationDialog({
  open,
  onOpenChange,
  application,
  saving,
  onSave,
  onReplaceResume,
  onRemoveResume,
}: EditApplicationDialogProps) {
  return (
    <Dialog open={open} onOpenChange={(next) => !saving && onOpenChange(next)}>
      <DialogContent className="flex max-h-[90vh] flex-col sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Edit application</DialogTitle>
          <DialogDescription>
            Changes apply in any status and the hacker sees them. To let the
            hacker make edits themselves, set the status to draft instead.
          </DialogDescription>
        </DialogHeader>
        {/* Remounted per open (and per application) so it starts from the saved answers. */}
        {open && application && (
          <EditApplicationForm
            key={application.id}
            application={application}
            saving={saving}
            onSave={onSave}
            onReplaceResume={onReplaceResume}
            onRemoveResume={onRemoveResume}
            onDone={() => onOpenChange(false)}
          />
        )}
      </DialogContent>
    </Dialog>
  );
});
