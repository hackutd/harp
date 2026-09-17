import { zodResolver } from "@hookform/resolvers/zod";
import { createElement, type ReactNode } from "react";
import type { Resolver } from "react-hook-form";
import { z } from "zod";

import type { ApplicationSchemaField } from "@/types";

/** Well-known section labels for backward compatibility with data that lacks section_label. */
const DEFAULT_SECTION_LABELS: Record<string, string> = {
  personal: "Personal Information",
  education: "Education",
  links: "Links & Profiles",
  experience: "Experience",
  short_answers: "Short Answer Questions",
  logistics: "Event Logistics",
  agreements: "Agreements",
};

export interface SectionDef {
  id: string;
  label: string;
}

/**
 * Derive an ordered list of sections from schema fields.
 * Uses section_order for ordering and section_label for display names,
 * falling back to DEFAULT_SECTION_LABELS for legacy data.
 */
export function deriveSections(fields: ApplicationSchemaField[]): SectionDef[] {
  const seen = new Map<string, { label: string; order: number }>();

  for (const f of fields) {
    if (!seen.has(f.section)) {
      seen.set(f.section, {
        label:
          f.section_label || DEFAULT_SECTION_LABELS[f.section] || f.section,
        order: f.section_order ?? 999,
      });
    }
  }

  return [...seen.entries()]
    .sort(([, a], [, b]) => a.order - b.order)
    .map(([id, { label }]) => ({ id, label }));
}

/**
 * Build SECTION_ORDER and SECTION_LABELS dynamically from schema fields.
 * Convenience wrapper used by components that need both.
 */
export function getSectionInfo(fields: ApplicationSchemaField[]) {
  const sections = deriveSections(fields);
  const order = sections.map((s) => s.id);
  const labels: Record<string, string> = {};
  for (const s of sections) {
    labels[s.id] = s.label;
  }
  return { order, labels };
}

/**
 * Resolve the section that hosts the resume uploader: "links" when present,
 * otherwise the last section. Keeps the resume from being orphaned when a
 * super admin renames or removes the "links" section.
 */
export function resolveResumeSectionId(
  fields: ApplicationSchemaField[],
): string | undefined {
  const sectionIds = deriveSections(fields).map((s) => s.id);
  if (sectionIds.includes("links")) return "links";
  return sectionIds[sectionIds.length - 1];
}

/** Group schema fields by section, sorted by display_order within each section. */
export function groupFieldsBySection(
  schema: ApplicationSchemaField[],
): Record<string, ApplicationSchemaField[]> {
  const groups: Record<string, ApplicationSchemaField[]> = {};

  // Initialize groups for all sections present in the schema
  for (const field of schema) {
    if (!groups[field.section]) {
      groups[field.section] = [];
    }
    groups[field.section].push(field);
  }

  // Sort fields within each section by display_order
  for (const section of Object.keys(groups)) {
    groups[section].sort((a, b) => a.display_order - b.display_order);
  }

  return groups;
}

/** Type-safe accessor for a response value. */
export function getResponseValue<T>(
  responses: Record<string, unknown> | undefined | null,
  fieldId: string,
  fallback: T,
): T {
  if (!responses) return fallback;
  const val = responses[fieldId];
  if (val === undefined || val === null) return fallback;
  return val as T;
}

/**
 * A conditional-field controller parsed from validation.show_if / required_if.
 * The raw expression is either a checkbox field id ("field", satisfied when
 * the answer is true) or a select equality ("field=Value", satisfied when the
 * answer equals the value).
 */
export interface FieldCondition {
  field: string;
  /** Expected select value; undefined means the controller is a checkbox. */
  value?: string;
}

/**
 * The condition controlling visibility ("show_if") or requirement
 * ("required_if") for a field, if it declares one in its validation map
 * (e.g. travel questions controlled by travel_reimbursement, or flight
 * fields controlled by travel_rsvp_mode=Flying).
 */
export function getFieldCondition(
  field: ApplicationSchemaField,
  key: "show_if" | "required_if",
): FieldCondition | undefined {
  const v = field.validation?.[key];
  if (typeof v !== "string" || v === "") return undefined;
  const eq = v.indexOf("=");
  if (eq > 0) return { field: v.slice(0, eq), value: v.slice(eq + 1) };
  return { field: v };
}

/** True when the condition's controller answer satisfies it. */
export function conditionSatisfied(
  condition: FieldCondition,
  values: Record<string, unknown> | undefined | null,
): boolean {
  const actual = values?.[condition.field];
  if (condition.value !== undefined) return actual === condition.value;
  return actual === true;
}

/** True when a field should be shown given the current answer values. */
export function isFieldVisible(
  field: ApplicationSchemaField,
  values: Record<string, unknown> | undefined | null,
): boolean {
  const condition = getFieldCondition(field, "show_if");
  return !condition || conditionSatisfied(condition, values);
}

/**
 * Number fields answered as a whole count, with a floor the stored schema can
 * raise but not lower. Keyed by field id (not type) so it applies to exactly the
 * well-known fields — the same approach as getFieldPresets in field-presets.ts.
 * Add an id here to give another number field the same treatment.
 *
 * Age is here because the seeded schema declares min: 0, which would otherwise
 * accept "0" as an age (and, being a plain number field, "20.5" as well).
 */
const WHOLE_NUMBER_FIELDS: Record<string, { min: number }> = {
  age: { min: 1 },
};

/** Whole-number rule for a field id, or undefined if it has none. */
export function getWholeNumberRule(
  fieldId: string,
): { min: number } | undefined {
  return WHOLE_NUMBER_FIELDS[fieldId];
}

/** Saved choices no longer offered by a configured select; text presets are unrelated. */
export function getObsoleteOptions(
  field: ApplicationSchemaField,
  value: unknown,
): string[] {
  if (!field.options?.length) return [];
  const selections =
    field.type === "select" && typeof value === "string" && value.trim()
      ? [value]
      : field.type === "multi_select" && Array.isArray(value)
        ? value.filter((item): item is string => typeof item === "string")
        : [];
  return [
    ...new Set(selections.filter((item) => !field.options!.includes(item))),
  ];
}

export interface SchemaValidationOptions {
  /** Draft navigation still checks required answers, but permits obsolete choices. */
  enforceOptions?: boolean;
}

/** Build a Zod schema for a single field based on its ApplicationSchemaField definition. */
function buildFieldZod(
  field: ApplicationSchemaField,
  { enforceOptions = true }: SchemaValidationOptions,
): z.ZodType {
  const validation = field.validation ?? {};
  // Agreement labels carry markdown links; error messages name the question only.
  const label = stripLabelLinks(field.label);

  switch (field.type) {
    case "text": {
      if (field.required) {
        // Trim-aware, so a whitespace-only answer fails here rather than making
        // it all the way to the server, which trims before its own check.
        return z
          .string()
          .refine((v) => v.trim() !== "", `${label} is required`);
      }
      return z.string().optional().default("");
    }
    case "phone": {
      // Accept full international numbers while retaining existing +1 values.
      const internationalPhone = /^\+[1-9]\d{6,14}$/;
      const msg =
        "Enter a country code and phone number with 7–15 digits in total";
      if (field.required) {
        return z
          .string()
          .min(1, `${label} is required`)
          .regex(internationalPhone, msg);
      }
      return z
        .string()
        .optional()
        .default("")
        .refine((v) => !v || internationalPhone.test(v), msg);
    }
    case "number": {
      let n = z.coerce.number({ message: `${label} is required` });
      const whole = getWholeNumberRule(field.id);
      if (whole) n = n.int(`${label} must be a whole number`);

      const schemaMin =
        typeof validation.min === "number"
          ? (validation.min as number)
          : undefined;
      // A whole-number field's floor is the higher of the two, so a super admin
      // can raise age's minimum but not drop it back below the rule.
      const min = whole
        ? Math.max(schemaMin ?? whole.min, whole.min)
        : schemaMin;

      if (typeof min === "number")
        n = n.min(min, `${label} must be at least ${min}`);
      if (typeof validation.max === "number") {
        const max = validation.max as number;
        n = n.max(max, `${label} must be at most ${max}`);
      }
      if (field.required && typeof min !== "number") n = n.min(0);

      // Numbers default to undefined rather than 0 (see buildDefaultValues), so
      // an untouched required field fails while an optional one passes.
      return field.required ? n : n.optional();
    }
    case "textarea": {
      let s = z.string();
      if (typeof validation.maxLength === "number") {
        const maxLength = validation.maxLength as number;
        s = s.max(
          maxLength,
          `${label} must be ${maxLength} characters or fewer`,
        );
      }
      if (field.required) {
        return s.refine((v) => v.trim() !== "", `${label} is required`);
      }
      return s;
    }
    case "select": {
      const s = field.required
        ? z.string().refine((v) => v.trim() !== "", `${label} is required`)
        : z.string().optional().default("");
      return s.refine(
        (v) => !enforceOptions || getObsoleteOptions(field, v).length === 0,
        `Choose a current option for ${label}`,
      );
    }
    case "multi_select": {
      const s = field.required
        ? z.array(z.string()).min(1, `${label} is required`)
        : z.array(z.string()).optional().default([]);
      return s.refine(
        (v) => !enforceOptions || getObsoleteOptions(field, v).length === 0,
        `Remove unavailable choices for ${label}`,
      );
    }
    case "checkbox":
      if (field.required) {
        return z.literal(true, {
          message: `${label} is required`,
        });
      }
      return z.boolean().optional().default(false);
    default:
      return z.string().optional().default("");
  }
}

/**
 * Build a Zod object schema from an array of ApplicationSchemaField definitions.
 * Returns a z.object() with one key per field.
 *
 * Conditional requiredness (validation.show_if / required_if) depends on
 * another field's answer, so it is resolved against `values` — the answers
 * being validated — and baked into the per-field schema:
 * - a field hidden by an unsatisfied "show_if" is never required (the step
 *   validator triggers every field in a section, including hidden ones, so
 *   enforcing it would block the step with nothing on screen to fix);
 * - a field with "required_if" is required once its controller is set.
 *
 * The rules live in the per-field schemas rather than in a top-level
 * superRefine because Zod drops an object's refinements as soon as one of its
 * properties raises a fatal issue — an untouched required number, or an
 * unchecked required checkbox (z.literal(true)), both of which are the norm
 * while the form is still being filled in. That silently disabled every
 * conditional rule until the rest of the form was already valid, letting the
 * wizard advance past an opted-in-but-empty travel section and only catching
 * it at submit.
 *
 * Callers that validate live answers should use buildSchemaResolver, which
 * feeds the current values back in on every validation pass. Omitting values
 * treats every condition as unsatisfied.
 */
export function buildZodSchema(
  fields: ApplicationSchemaField[],
  values?: Record<string, unknown> | null,
  options: SchemaValidationOptions = {},
) {
  const shape: Record<string, z.ZodType> = {};

  for (const field of fields) {
    const showIf = getFieldCondition(field, "show_if");
    const requiredIf = getFieldCondition(field, "required_if");

    const visible = !showIf || conditionSatisfied(showIf, values);
    const required =
      visible &&
      (field.required ||
        (!!requiredIf && conditionSatisfied(requiredIf, values)));

    shape[field.id] = buildFieldZod({ ...field, required }, options);
  }

  return z.object(shape);
}

/** Field ids that gate another field's visibility or requiredness. */
function conditionControllerIds(fields: ApplicationSchemaField[]): string[] {
  return [
    ...new Set(
      fields.flatMap((f) =>
        [
          getFieldCondition(f, "show_if")?.field,
          getFieldCondition(f, "required_if")?.field,
        ].filter((id): id is string => !!id),
      ),
    ),
  ];
}

/**
 * React Hook Form resolver for a dynamic application schema. The schema is
 * rebuilt from the answers under validation so show_if / required_if rules see
 * the current controller values; the build is reused until one of those
 * controllers changes.
 */
export function buildSchemaResolver(
  fields: ApplicationSchemaField[],
  validationOptions: SchemaValidationOptions = {},
): Resolver<Record<string, unknown>> {
  const controllerIds = conditionControllerIds(fields);
  let cachedKey: string | undefined;
  let cachedResolver: Resolver<Record<string, unknown>> | undefined;

  return (values, context, options) => {
    const key = JSON.stringify(controllerIds.map((id) => values[id] ?? null));
    if (!cachedResolver || key !== cachedKey) {
      cachedResolver = zodResolver(
        buildZodSchema(fields, values, validationOptions),
      ) as Resolver<Record<string, unknown>>;
      cachedKey = key;
    }
    return cachedResolver(values, context, options);
  };
}

/** Build default form values from schema fields. */
export function buildDefaultValues(
  fields: ApplicationSchemaField[],
): Record<string, unknown> {
  const defaults: Record<string, unknown> = {};
  for (const field of fields) {
    switch (field.type) {
      // Numbers start blank rather than at 0: a pre-filled 0 satisfies a
      // required field (and age's seeded min of 0) without the hacker ever
      // answering it.
      case "number":
        defaults[field.id] = undefined;
        break;
      case "multi_select":
        defaults[field.id] = [];
        break;
      case "checkbox":
        defaults[field.id] = false;
        break;
      default:
        defaults[field.id] = "";
    }
  }
  return defaults;
}

/** Format a response value for display. */
export function formatResponseValue(
  value: unknown,
  field: ApplicationSchemaField,
): string {
  if (value === null || value === undefined || value === "")
    return "Not provided";

  if (field.type === "multi_select" && Array.isArray(value)) {
    return value.length > 0 ? value.join(", ") : "None";
  }
  if (field.type === "checkbox") {
    return value ? "Yes" : "No";
  }
  if (field.type === "number") {
    return String(value);
  }
  return String(value);
}

const LINK_RE = /\[([^\]]+)\]\((https?:\/\/[^)]+)\)/g;

/** Strip markdown-style links from a label, keeping only the text. */
export function stripLabelLinks(label: string): string {
  return label.replace(LINK_RE, "$1");
}

/** Parse markdown-style [text](url) links in a label and return React nodes. */
export function renderLabel(label: string): ReactNode {
  if (!label.includes("[")) return label;

  const parts: ReactNode[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  let key = 0;

  const re = new RegExp(LINK_RE.source, LINK_RE.flags);
  while ((match = re.exec(label)) !== null) {
    if (match.index > lastIndex) {
      parts.push(label.slice(lastIndex, match.index));
    }
    parts.push(
      createElement(
        "a",
        {
          key: key++,
          href: match[2],
          target: "_blank",
          rel: "noopener noreferrer",
          className:
            "bg-[linear-gradient(currentColor,currentColor)] bg-[position:0_100%] bg-[length:0_1px] bg-no-repeat text-blue-600 transition-[background-size,color] duration-300 ease-out hover:bg-[length:100%_1px] hover:text-blue-800 motion-reduce:transition-none",
        },
        match[1],
      ),
    );
    lastIndex = re.lastIndex;
  }

  if (lastIndex < label.length) {
    parts.push(label.slice(lastIndex));
  }

  return parts.length > 0 ? parts : label;
}
