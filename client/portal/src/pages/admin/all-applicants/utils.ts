export function getStatusColor(status: string): string {
  switch (status) {
    case "accepted":
      return "bg-green-100 text-green-800";
    case "rejected":
      return "bg-red-100 text-red-800";
    case "waitlisted":
      return "bg-yellow-100 text-yellow-800";
    case "submitted":
      return "bg-blue-100 text-blue-800";
    case "draft":
      return "bg-gray-100 text-gray-800";
    case "confirmed":
      return "bg-green-100 text-green-800";
    case "declined":
      return "bg-yellow-100 text-yellow-800";
    case "pending":
      return "bg-gray-100 text-gray-800";
    default:
      return "bg-gray-100 text-gray-800";
  }
}

/**
 * Display name for an applicant, falling back to their email.
 *
 * Walk-ins get an application row with empty responses (see WalkInsStore), so
 * first_name/last_name are null for them forever and there is no name to
 * recover — without the fallback those rows read as "-" in every admin view.
 * Pass the email only from non-redacted branches; redacted views use
 * formatApplicantLabel/maskEmail instead.
 */
export function formatName(
  firstName: string | null,
  lastName: string | null,
  fallbackEmail?: string | null,
): string {
  const name = `${firstName ?? ""} ${lastName ?? ""}`.trim();
  if (name) return name;
  return fallbackEmail || "-";
}
