import type { FieldErrors } from "react-hook-form";

import type { ApplicationSchemaField } from "@/types";

import {
  deriveSections,
  groupFieldsBySection,
  stripLabelLinks,
} from "./schema-utils";

/** A form section holding at least one question the hacker still has to fix. */
export interface IncompleteSection {
  id: string;
  label: string;
  /** Labels of the offending questions, in the order they're rendered. */
  fieldLabels: string[];
}

/**
 * Group validation errors by the section that owns each field, so a failed
 * submit can name the sections and questions that need attention instead of
 * saying "complete all required fields" and leaving the hacker to hunt for
 * them — conditional questions (travel reimbursement, flight details) are
 * especially easy to miss.
 */
export function collectIncompleteSections(
  schema: ApplicationSchemaField[],
  errors: FieldErrors,
): IncompleteSection[] {
  const grouped = groupFieldsBySection(schema);
  const incomplete: IncompleteSection[] = [];

  for (const section of deriveSections(schema)) {
    const fieldLabels = (grouped[section.id] ?? [])
      .filter((field) => errors[field.id])
      .map((field) => stripLabelLinks(field.label));

    if (fieldLabels.length > 0) {
      incomplete.push({
        id: section.id,
        label: section.label,
        fieldLabels,
      });
    }
  }

  return incomplete;
}

/** Total number of questions flagged across the sections. */
export function countIncompleteFields(sections: IncompleteSection[]): number {
  return sections.reduce((total, s) => total + s.fieldLabels.length, 0);
}

/** Join names into a readable list: "A", "A and B", "A, B, and C". */
export function joinNames(names: string[]): string {
  if (names.length === 0) return "";
  if (names.length === 1) return names[0];
  if (names.length === 2) return `${names[0]} and ${names[1]}`;
  return `${names.slice(0, -1).join(", ")}, and ${names[names.length - 1]}`;
}

/**
 * One-line summary for a toast: names the questions when there are only a
 * couple, and falls back to a count so the message can't run away.
 */
export function summarizeIncomplete(sections: IncompleteSection[]): string {
  const labels = sections.flatMap((s) => s.fieldLabels);
  if (labels.length === 0) return "Some answers still need fixing";
  if (labels.length === 1) return `"${labels[0]}" still needs an answer`;
  if (labels.length === 2) {
    return `${joinNames(labels.map((l) => `"${l}"`))} still need answers`;
  }
  return `${labels.length} questions still need answers`;
}

/**
 * Bring the first invalid control into view. react-hook-form focuses the first
 * errored field on a failed submit, but several of ours are custom triggers
 * (popover selects, comboboxes) that never take focus, so scroll explicitly.
 */
export function scrollToFirstInvalidField(root?: ParentNode | null): void {
  const el = (root ?? document).querySelector<HTMLElement>(
    '[aria-invalid="true"]',
  );
  el?.scrollIntoView({ behavior: "smooth", block: "center" });
}
