import type { ApplicationListItem } from "@/pages/admin/all-applicants/types";
import type { Application } from "@/types";

/** Blank answers are stored as absent, so "" and [] both mean "no answer". */
function normalizeAnswer(value: unknown): unknown {
  if (value === undefined || value === null) return null;
  if (typeof value === "string" && value.trim() === "") return null;
  if (Array.isArray(value) && value.length === 0) return null;
  if (typeof value === "number" && Number.isNaN(value)) return null;
  return value;
}

/**
 * The answers a super admin changed, in the merge-patch shape the backend
 * expects: changed answers carry their new value, cleared answers are null,
 * untouched answers are left out.
 */
export function buildResponsesPatch(
  original: Record<string, unknown>,
  edited: Record<string, unknown>,
): Record<string, unknown> {
  const patch: Record<string, unknown> = {};
  const keys = new Set([...Object.keys(original), ...Object.keys(edited)]);

  for (const key of keys) {
    const before = normalizeAnswer(original[key]);
    const after = normalizeAnswer(edited[key]);
    if (JSON.stringify(before) !== JSON.stringify(after)) {
      patch[key] = after;
    }
  }

  return patch;
}

function answerString(responses: Record<string, unknown>, key: string) {
  const value = responses[key];
  return typeof value === "string" && value !== "" ? value : null;
}

function answerNumber(responses: Record<string, unknown>, key: string) {
  const value = responses[key];
  return typeof value === "number" ? value : null;
}

/**
 * Carries an edited application back into its queue row, so the header and
 * panel reflect the edit without refetching the page of applications.
 */
export function syncListItem(
  item: ApplicationListItem,
  application: Application,
): ApplicationListItem {
  const responses = application.responses ?? {};

  return {
    ...item,
    status: application.status,
    has_resume: application.resume_path != null,
    first_name: answerString(responses, "first_name"),
    last_name: answerString(responses, "last_name"),
    phone: answerString(responses, "phone"),
    age: answerNumber(responses, "age"),
    country_of_residence: answerString(responses, "country_of_residence"),
    gender: answerString(responses, "gender"),
    university: answerString(responses, "university"),
    major: answerString(responses, "major"),
    level_of_study: answerString(responses, "level_of_study"),
    hackathons_attended: answerNumber(responses, "hackathons_attended"),
  };
}
