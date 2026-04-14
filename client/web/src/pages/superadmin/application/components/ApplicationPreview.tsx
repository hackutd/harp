import { groupFieldsBySection, type SectionDef } from "@/shared/lib/schema-utils";
import type { ApplicationSchemaField } from "@/types";

interface ApplicationPreviewProps {
  fields: ApplicationSchemaField[];
  sections: SectionDef[];
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
        <div className="h-px bg-gray-200" />
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
      <label className="text-xs font-medium text-gray-700">
        {label}
        {required && <span className="text-gray-400 ml-1">*</span>}
      </label>
      <div className="h-9 rounded-md border border-gray-200 bg-gray-50 px-3 flex items-center">
        <span className="text-xs text-gray-400">{placeholder}</span>
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
      <label className="text-xs font-medium text-gray-700">
        {label}
        {required && <span className="text-gray-400 ml-1">*</span>}
      </label>
      <div className="min-h-[80px] rounded-md border border-gray-200 bg-gray-50 px-3 py-2 flex items-start">
        <span className="text-xs text-gray-400">{placeholder}</span>
      </div>
    </div>
  );
}

function PreviewCheckbox({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-2">
      <div className="size-4 rounded border border-gray-300 bg-white shrink-0" />
      <span className="text-xs text-gray-500">{label}</span>
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
          <label className="text-xs font-medium text-gray-700">
            {field.label}
            {field.required && <span className="text-gray-400 ml-1">*</span>}
            <span className="text-gray-400 ml-1 font-normal">
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
      return (
        <PreviewCheckbox key={field.id} label={field.label} />
      );
  }
}

export function ApplicationPreview({ fields, sections }: ApplicationPreviewProps) {
  const grouped = groupFieldsBySection(fields);

  const sectionsWithFields = sections.filter(
    (s) => grouped[s.id] && grouped[s.id].length > 0,
  );

  const stepPills = [
    ...sectionsWithFields.map((s) => s.label),
    "Agreements",
  ];

  return (
    <div className="p-6 space-y-8">
      {/* Step pills */}
      <div className="flex gap-1.5 flex-wrap">
        {stepPills.map((label) => (
          <span
            key={label}
            className="text-[10px] px-2 py-0.5 rounded-full bg-gray-100 text-gray-500"
          >
            {label}
          </span>
        ))}
      </div>

      {/* Dynamic sections from schema */}
      {sectionsWithFields.map((section) => {
        const sectionFields = grouped[section.id] ?? [];

        return (
          <PreviewSection key={section.id} title={section.label}>
            {sectionFields.map(renderField)}
          </PreviewSection>
        );
      })}

      {/* Hardcoded Agreements section (not part of configurable schema) */}
      <PreviewSection title="Agreements">
        <div className="space-y-3">
          <PreviewCheckbox label="I understand that this is an application and does not guarantee admission. *" />
          <PreviewCheckbox label="I have read and agree to the MLH Code of Conduct. *" />
          <PreviewCheckbox label="I authorize sharing my information with MLH per their Privacy Policy. *" />
          <PreviewCheckbox label="I authorize MLH to send me occasional emails about events and opportunities." />
        </div>
      </PreviewSection>
    </div>
  );
}
