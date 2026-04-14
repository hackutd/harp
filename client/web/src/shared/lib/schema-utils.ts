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

/** Build a Zod schema for a single field based on its ApplicationSchemaField definition. */
function buildFieldZod(field: ApplicationSchemaField): z.ZodType {
  const validation = field.validation ?? {};

  switch (field.type) {
    case "text": {
      if (field.required) {
        return z.string().min(1, `${field.label} is required`);
      }
      return z.string().optional().default("");
    }
    case "phone": {
      if (field.required) {
        return z
          .string()
          .min(1, `${field.label} is required`)
          .regex(
            /^\+[1-9]\d{1,14}$/,
            "Phone must be in E.164 format (e.g., +12025551234)",
          );
      }
      return z.string().optional().default("");
    }
    case "number": {
      let n = z.coerce.number({ message: `${field.label} is required` });
      if (typeof validation.min === "number")
        n = n.min(validation.min as number);
      if (typeof validation.max === "number")
        n = n.max(validation.max as number);
      if (field.required && typeof validation.min !== "number")
        n = n.min(0);
      return n;
    }
    case "textarea": {
      let s = z.string();
      if (field.required) s = s.min(1, `${field.label} is required`);
      if (typeof validation.maxLength === "number")
        s = s.max(validation.maxLength as number);
      return s;
    }
    case "select": {
      if (field.required) {
        return z.string().min(1, `${field.label} is required`);
      }
      return z.string().optional().default("");
    }
    case "multi_select":
      return z.array(z.string()).optional().default([]);
    case "checkbox":
      return z.boolean().optional().default(false);
    default:
      return z.string().optional().default("");
  }
}

/**
 * Build a Zod object schema from an array of ApplicationSchemaField definitions.
 * Returns a z.object() with one key per field.
 */
export function buildZodSchema(fields: ApplicationSchemaField[]) {
  const shape: Record<string, z.ZodType> = {};
  for (const field of fields) {
    shape[field.id] = buildFieldZod(field);
  }
  return z.object(shape);
}

/** Build default form values from schema fields. */
export function buildDefaultValues(
  fields: ApplicationSchemaField[],
): Record<string, unknown> {
  const defaults: Record<string, unknown> = {};
  for (const field of fields) {
    switch (field.type) {
      case "number":
        defaults[field.id] = 0;
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
  if (value === null || value === undefined || value === "") return "Not provided";

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
