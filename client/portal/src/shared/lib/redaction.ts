/**
 * Applicant identity redaction for admin-facing views.
 *
 * Reviewers with the `admin` role grade applications without seeing who wrote
 * them: name, race, and ethnicity are stripped from every admin surface, and
 * emails are masked (school addresses usually spell out the applicant's name).
 * Super admins keep full visibility — they send decision emails and manage
 * users, both of which need the real identity.
 *
 * This is a display-layer measure. The API still returns the full record, so it
 * removes bias from the review screen; it is not an access control boundary.
 */

/**
 * Schema field ids stripped from redacted views.
 *
 * Keyed by field id rather than label or type — the same convention
 * `field-presets.ts` uses — so renaming a field's label in the schema editor
 * doesn't silently un-redact it. Add an id here to hide another field.
 */
const REDACTED_FIELD_IDS: ReadonlySet<string> = new Set([
  "first_name",
  "last_name",
  "race",
  "ethnicity",
]);

/** Whether a schema field is hidden from admins. */
export function isRedactedField(fieldId: string): boolean {
  return REDACTED_FIELD_IDS.has(fieldId);
}

/**
 * Stable stand-in for an applicant's name, e.g. "Applicant 4f2a1c".
 *
 * Derived from the application id so a row stays referenceable — an admin can
 * still flag a specific applicant to a super admin — without naming anyone.
 */
export function formatApplicantLabel(applicationId: string): string {
  const short = applicationId.replace(/-/g, "").slice(0, 6);
  return short ? `Applicant ${short}` : "Applicant";
}

/** Mask an email down to its first character and domain, e.g. "j•••@utdallas.edu". */
export function maskEmail(email: string): string {
  const at = email.lastIndexOf("@");
  if (at <= 0) return "•••";
  return `${email[0]}•••@${email.slice(at + 1)}`;
}
