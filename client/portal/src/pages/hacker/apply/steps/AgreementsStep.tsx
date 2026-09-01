import { useState } from "react";
import { type FieldValues, useFormContext } from "react-hook-form";

import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Checkbox } from "@/components/ui/checkbox";
import { renderLabel, stripLabelLinks } from "@/shared/lib/schema-utils";
import type { ApplicationSchemaField } from "@/types";

interface AgreementsStepProps {
  sectionLabel: string;
  fields: ApplicationSchemaField[];
}

/** Extract markdown-style `[text](url)` link labels from an agreement label. */
function linkTitles(label: string): string[] {
  const re = /\[([^\]]+)\]\((?:https?:\/\/[^)]+)\)/g;
  const out: string[] = [];
  let match: RegExpExecArray | null;
  while ((match = re.exec(label)) !== null) out.push(match[1]);
  return out;
}

/** Trim text to a short summary at a word boundary. */
function shorten(text: string, max = 40): string {
  const clean = text.trim();
  if (clean.length <= max) return clean;
  const slice = clean.slice(0, max);
  const cut = slice.lastIndexOf(" ");
  return `${(cut > 20 ? slice.slice(0, cut) : slice).trimEnd()}…`;
}

/** A brief title for the collapsed row; the full text lives in the panel. */
function deriveTitle(label: string): string {
  const links = linkTitles(label);
  // Prefer the primary linked document name when present.
  if (links.length > 0) return links[0];
  return shorten(stripLabelLinks(label));
}

export function AgreementsStep({ sectionLabel, fields }: AgreementsStepProps) {
  const [openItem, setOpenItem] = useState<string>("");

  return (
    <div className="mx-auto w-full max-w-lg space-y-6 md:max-w-none">
      <div className="space-y-2">
        <h1 className="text-3xl font-light tracking-tight text-black">
          {sectionLabel}
        </h1>
        <p className="text-sm font-light text-[#8A8A8A]">
          Review and accept each item. Expand a row to read the details.
        </p>
      </div>

      {fields.length === 0 ? (
        <p className="text-sm font-light text-[#8A8A8A]">
          No agreements configured.
        </p>
      ) : (
        <Accordion
          type="single"
          collapsible
          value={openItem}
          onValueChange={setOpenItem}
        >
          {fields.map((field) =>
            linkTitles(field.label).length > 0 ? (
              <AgreementItem
                key={field.id}
                field={field}
                onAccept={() => setOpenItem(field.id)}
              />
            ) : (
              <AgreementPlainRow key={field.id} field={field} />
            ),
          )}
        </Accordion>
      )}
    </div>
  );
}

function AgreementItem({
  field,
  onAccept,
}: {
  field: ApplicationSchemaField;
  onAccept: () => void;
}) {
  const form = useFormContext<FieldValues>();
  const checked = Boolean(form.watch(field.id));
  const error = form.formState.errors[field.id];

  const toggle = (next: boolean) => {
    form.setValue(field.id, next, {
      shouldValidate: true,
      shouldDirty: true,
      shouldTouch: true,
    });
    // Checking a box opens its details; single-accordion mode closes any other.
    if (next) onAccept();
  };

  return (
    <AccordionItem value={field.id}>
      <div className="flex items-center gap-3">
        <Checkbox
          checked={checked}
          onCheckedChange={(v) => toggle(v === true)}
          aria-label={`Accept: ${stripLabelLinks(field.label)}`}
          aria-invalid={Boolean(error)}
          className="size-[18px] shrink-0 rounded-[5px] data-[state=checked]:border-black data-[state=checked]:bg-black data-[state=checked]:text-white"
        />
        <div className="min-w-0 flex-1">
          <AccordionTrigger className="font-light">
            <span>
              {deriveTitle(field.label)}
              {field.required && <span className="text-red-500"> *</span>}
            </span>
          </AccordionTrigger>
        </div>
      </div>
      <AccordionContent className="pl-[30px] text-[#555]">
        {renderLabel(field.label)}
        {error && (
          <p className="mt-2 text-xs text-red-500">
            {String(error.message ?? "This agreement is required")}
          </p>
        )}
      </AccordionContent>
    </AccordionItem>
  );
}

/**
 * A compact, non-collapsible agreement row for items without linked documents
 * (e.g. the occasional-emails opt-in). The full text is shown inline.
 */
function AgreementPlainRow({ field }: { field: ApplicationSchemaField }) {
  const form = useFormContext<FieldValues>();
  const checked = Boolean(form.watch(field.id));
  const error = form.formState.errors[field.id];

  const toggle = (next: boolean) =>
    form.setValue(field.id, next, {
      shouldValidate: true,
      shouldDirty: true,
      shouldTouch: true,
    });

  return (
    <div className="border-b py-3 last:border-b-0">
      <label className="flex items-start gap-3">
        <Checkbox
          checked={checked}
          onCheckedChange={(v) => toggle(v === true)}
          aria-label={`Accept: ${stripLabelLinks(field.label)}`}
          aria-invalid={Boolean(error)}
          className="mt-0.5 size-[18px] shrink-0 rounded-[5px] data-[state=checked]:border-black data-[state=checked]:bg-black data-[state=checked]:text-white"
        />
        <span className="min-w-0 flex-1 text-xs font-light text-[#555]">
          {renderLabel(field.label)}
          {field.required && <span className="text-red-500"> *</span>}
        </span>
      </label>
      {error && (
        <p className="mt-2 pl-[30px] text-xs text-red-500">
          {String(error.message ?? "This agreement is required")}
        </p>
      )}
    </div>
  );
}
