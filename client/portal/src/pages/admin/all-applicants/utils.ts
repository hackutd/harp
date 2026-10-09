import { BADGE_COLORS } from "@/shared/lib/badge-colors";
import type { RSVPStatus } from "@/types";

import type { ApplicationStatus, AttendanceView, FetchParams } from "./types";

export function getStatusColor(status: string): string {
  switch (status) {
    case "accepted":
      return BADGE_COLORS.green;
    case "rejected":
      return BADGE_COLORS.red;
    case "waitlisted":
      return BADGE_COLORS.orange;
    case "submitted":
      return BADGE_COLORS.blue;
    case "draft":
      return BADGE_COLORS.neutral;
    case "confirmed":
      return BADGE_COLORS.green;
    case "declined":
      return BADGE_COLORS.orange;
    case "pending":
      return BADGE_COLORS.neutral;
    case "approved":
      return BADGE_COLORS.green;
    default:
      return BADGE_COLORS.neutral;
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

/**
 * Compact check-in time for the applicants table, e.g. "Sat 9:41 AM". A
 * hackathon runs over a weekend, so the weekday disambiguates without a date.
 */
export function formatCheckIn(iso: string): string {
  return new Date(iso).toLocaleString(undefined, {
    weekday: "short",
    hour: "numeric",
    minute: "2-digit",
  });
}

type AttendanceFilters = Required<
  Pick<FetchParams, "status" | "rsvp_status" | "checked_in">
>;

/**
 * The list filters behind each attendance preset. RSVP presets pin
 * status=accepted because every application row defaults to rsvp_status
 * "pending" -- without the pin, "RSVP pending" would sweep in every draft.
 * "Checked in" clears status (null): the scanner only admits accepted hackers,
 * but a status edited after check-in should not hide someone who was there.
 */
export const ATTENDANCE_VIEW_FILTERS: Record<
  AttendanceView,
  AttendanceFilters
> = {
  rsvp_pending: {
    status: "accepted",
    rsvp_status: "pending",
    checked_in: null,
  },
  rsvp_confirmed: {
    status: "accepted",
    rsvp_status: "confirmed",
    checked_in: null,
  },
  rsvp_declined: {
    status: "accepted",
    rsvp_status: "declined",
    checked_in: null,
  },
  checked_in: { status: null, rsvp_status: null, checked_in: true },
  no_show: { status: "accepted", rsvp_status: "confirmed", checked_in: false },
};

export const ATTENDANCE_VIEW_LABELS: Record<AttendanceView, string> = {
  rsvp_pending: "RSVP pending",
  rsvp_confirmed: "RSVP confirmed",
  rsvp_declined: "RSVP declined",
  checked_in: "Checked in",
  no_show: "No-show",
};

export function isAttendanceView(value: unknown): value is AttendanceView {
  return (
    typeof value === "string" &&
    Object.prototype.hasOwnProperty.call(ATTENDANCE_VIEW_FILTERS, value)
  );
}

/**
 * Reverse of ATTENDANCE_VIEW_FILTERS: which preset, if any, the current
 * filters amount to. "Checked in" matches under any status, so a remembered
 * status never hides the view it belongs to.
 */
export function attendanceViewOf(
  status: ApplicationStatus | null,
  rsvpStatus: RSVPStatus | null,
  checkedIn: boolean | null,
): AttendanceView | null {
  if (rsvpStatus === null) {
    return checkedIn === true ? "checked_in" : null;
  }
  if (status !== "accepted") return null;
  if (checkedIn === null) {
    return rsvpStatus === "pending"
      ? "rsvp_pending"
      : rsvpStatus === "confirmed"
        ? "rsvp_confirmed"
        : "rsvp_declined";
  }
  return rsvpStatus === "confirmed" && checkedIn === false ? "no_show" : null;
}
