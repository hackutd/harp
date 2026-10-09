import {
  IconCircleCheck,
  IconReceipt,
  IconTrash,
  IconUpload,
} from "@tabler/icons-react";

import { Button } from "@/components/ui/button";
import { BADGE_COLORS } from "@/shared/lib/badge-colors";
import {
  groupFieldsBySection,
  renderLabel,
  type SectionDef,
} from "@/shared/lib/schema-utils";
import type { ApplicationSchemaField } from "@/types";

const RESUME_PREVIEW_MAX_MB = 5;

interface ApplicationPreviewProps {
  fields: ApplicationSchemaField[];
  sections: SectionDef[];
  systemBlock?: "rsvp_decision" | "travel_receipts";
}

function PreviewSection({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-4">
      <div className="space-y-1">
        <h3 className="text-sm font-medium">{title}</h3>
        <div className="h-px bg-border" />
      </div>
      <div className="space-y-3">{children}</div>
    </div>
  );
}

function PreviewField({
  label,
  placeholder,
  required,
}: {
  label: string;
  placeholder: string;
  required?: boolean;
}) {
  return (
    <div className="space-y-1.5">
      <label className="text-xs font-medium text-foreground/80">
        {label}
        {required && <span className="text-muted-foreground ml-1">*</span>}
      </label>
      <div className="h-9 rounded-md border border-border bg-muted/50 px-3 flex items-center">
        <span className="text-xs text-muted-foreground">{placeholder}</span>
      </div>
    </div>
  );
}

function PreviewTextarea({
  label,
  placeholder,
  required,
}: {
  label: string;
  placeholder: string;
  required?: boolean;
}) {
  return (
    <div className="space-y-1.5">
      <label className="text-xs font-medium text-foreground/80">
        {label}
        {required && <span className="text-muted-foreground ml-1">*</span>}
      </label>
      <div className="min-h-[80px] rounded-md border border-border bg-muted/50 px-3 py-2 flex items-start">
        <span className="text-xs text-muted-foreground">{placeholder}</span>
      </div>
    </div>
  );
}

function PreviewCheckbox({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-2">
      <div className="size-4 rounded border border-border bg-background shrink-0" />
      <span className="text-xs text-muted-foreground">
        {renderLabel(label)}
      </span>
    </div>
  );
}

function PreviewResumeCard() {
  return (
    <div className="rounded-lg border p-4 space-y-3">
      <div>
        <h3 className="font-medium">Resume (Optional)</h3>
        <p className="text-sm text-muted-foreground">
          Upload a PDF up to {RESUME_PREVIEW_MAX_MB} MB.
        </p>
      </div>

      <p className="text-sm">No resume uploaded.</p>

      <div className="flex flex-wrap gap-2">
        <Button type="button" variant="outline" disabled>
          <IconUpload className="w-4 h-4 mr-2" />
          Upload Resume
        </Button>

        <Button type="button" variant="outline" disabled>
          <IconTrash className="w-4 h-4 mr-2" />
          Delete Resume
        </Button>
      </div>
    </div>
  );
}

function renderField(field: ApplicationSchemaField) {
  switch (field.type) {
    case "text":
    case "phone":
    case "number":
      return (
        <PreviewField
          key={field.id}
          label={field.label}
          placeholder={
            field.type === "phone"
              ? "+1 (202) 555-1234"
              : field.type === "number"
                ? "0"
                : "Enter..."
          }
          required={field.required}
        />
      );
    case "textarea":
      return (
        <PreviewTextarea
          key={field.id}
          label={field.label}
          placeholder="Your answer..."
          required={field.required}
        />
      );
    case "select":
      return (
        <PreviewField
          key={field.id}
          label={field.label}
          placeholder="Select..."
          required={field.required}
        />
      );
    case "multi_select":
      return (
        <div key={field.id} className="space-y-1.5">
          <label className="text-xs font-medium text-foreground/80">
            {field.label}
            {field.required && (
              <span className="text-muted-foreground ml-1">*</span>
            )}
            <span className="text-muted-foreground ml-1 font-normal">
              — select all that apply
            </span>
          </label>
          <div className="grid grid-cols-2 gap-2">
            {(field.options ?? []).map((option) => (
              <PreviewCheckbox key={option} label={option} />
            ))}
          </div>
        </div>
      );
    case "checkbox":
      return <PreviewCheckbox key={field.id} label={field.label} />;
  }
}

export function ApplicationPreview({
  fields,
  sections,
  systemBlock,
}: ApplicationPreviewProps) {
  const grouped = groupFieldsBySection(fields);

  const previewSections = sections.filter(
    (section) =>
      (grouped[section.id]?.length ?? 0) > 0 || section.id === "links",
  );

  const stepPills = previewSections.map((section) => section.label);

  return (
    <div className="p-6 space-y-8">
      {/* Step pills */}
      <div className="flex gap-1.5 flex-wrap">
        {stepPills.map((label) => (
          <span
            key={label}
            className="text-[10px] px-2 py-0.5 rounded-full bg-muted text-muted-foreground"
          >
            {label}
          </span>
        ))}
      </div>

      {/* Dynamic sections from schema */}
      {previewSections.map((section) => {
        const sectionFields = grouped[section.id] ?? [];

        return (
          <PreviewSection key={section.id} title={section.label}>
            {sectionFields.map(renderField)}
            {section.id === "links" && <PreviewResumeCard />}
          </PreviewSection>
        );
      })}

      {systemBlock === "rsvp_decision" && (
        <div className="space-y-3 rounded-lg border p-4">
          <div className="flex items-center gap-2">
            <IconCircleCheck className="size-4 text-muted-foreground" />
            <h3 className="font-medium">Attendance decision</h3>
            <span
              className={`ml-auto rounded-full px-2 py-0.5 text-[10px] ${BADGE_COLORS.neutral}`}
            >
              Built in
            </span>
          </div>
          <p className="text-sm text-muted-foreground">
            Accepted hackers confirm or decline their spot before submitting
            these answers.
          </p>
          <div className="grid grid-cols-2 gap-2">
            <Button type="button" variant="outline" disabled>
              Decline spot
            </Button>
            <Button type="button" disabled>
              Confirm spot
            </Button>
          </div>
        </div>
      )}

      {systemBlock === "travel_receipts" && (
        <div className="space-y-3 rounded-lg border p-4">
          <div className="flex items-center gap-2">
            <IconReceipt className="size-4 text-muted-foreground" />
            <h3 className="font-medium">Travel receipts</h3>
            <span
              className={`ml-auto rounded-full px-2 py-0.5 text-[10px] ${BADGE_COLORS.neutral}`}
            >
              Built in
            </span>
          </div>
          <p className="text-sm text-muted-foreground">
            Hackers can upload multiple PDF or image receipts. This block is
            always included and cannot be removed from the schema.
          </p>
          <Button type="button" variant="outline" disabled className="w-full">
            <IconUpload className="size-4" />
            Add receipts
          </Button>
        </div>
      )}
    </div>
  );
}
