/**
 * Applicant identity redaction for admin-facing views.
 *
 * Reviewers with the `admin` role grade applications without seeing who wrote
 * them: name, race, ethnicity, phone, profile links (GitHub, LinkedIn, personal
 * site), and the resume are stripped from every admin surface, and emails are
 * masked (school addresses usually spell out the applicant's name). Super
 * admins keep full visibility — they send decision emails and manage users,
 * both of which need the real identity.
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
  "phone",
  "race",
  "ethnicity",
  "github",
  "linkedin",
  "website",
]);

/**
 * Label fallback for fields created in the schema editor, which get opaque
 * ids (`field_<timestamp>`) that can't be listed above. Deliberately narrow
 * — "Preferred Name", "Nickname" — so "Team Name" or "Name of your
 * university" stay visible.
 */
const REDACTED_LABEL_PATTERN =
  /\b(?:preferred|first|last|full|legal|chosen|display)\s+name\b|\bnickname\b/i;

/** Whether a schema field is hidden from admins. */
export function isRedactedField(field: { id: string; label: string }): boolean {
  return (
    REDACTED_FIELD_IDS.has(field.id) || REDACTED_LABEL_PATTERN.test(field.label)
  );
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
