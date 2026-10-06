import type { ApplicationStatus } from "@/pages/admin/all-applicants/types";
import type { RSVPStatus } from "@/types";

/** Statuses a decision email can be sent to. Draft and submitted have no decision. */
export type DecidedStatus = Extract<
  ApplicationStatus,
  "accepted" | "waitlisted" | "rejected"
>;

export const DECIDED_STATUSES: DecidedStatus[] = [
  "accepted",
  "waitlisted",
  "rejected",
];

/** Every application status, in pipeline order. CSV export accepts any of these. */
export const APPLICATION_STATUSES: ApplicationStatus[] = [
  "draft",
  "submitted",
  "accepted",
  "waitlisted",
  "rejected",
];

export const APPLICATION_STATUS_LABELS: Record<ApplicationStatus, string> = {
  draft: "Draft",
  submitted: "Submitted",
  accepted: "Accepted",
  waitlisted: "Waitlisted",
  rejected: "Rejected",
};

/**
 * RSVP follow-up exports. Each is accepted applicants narrowed by RSVP state;
 * the pending list is the one to send an RSVP reminder to.
 */
export const RSVP_EXPORT_STATUSES: RSVPStatus[] = [
  "pending",
  "confirmed",
  "declined",
];

export const RSVP_EXPORT_OPTIONS: Record<
  RSVPStatus,
  { label: string; description: string }
> = {
  pending: {
    label: "RSVP pending",
    description: "Accepted but have not responded. Use for RSVP reminders.",
  },
  confirmed: {
    label: "RSVP confirmed",
    description: "Claimed their spot. Use for pre-event logistics.",
  },
  declined: {
    label: "RSVP declined",
    description: "Gave up their spot.",
  },
};

/**
 * "decision" tells each applicant their outcome; "announcement" tells every
 * decided applicant that decisions are out without revealing which one.
 */
export type DecisionEmailMode = "decision" | "announcement";

export interface EmailSendCounts {
  total: number;
  sent: number;
  pending: number;
}

export interface DecisionEmailStats {
  accepted: EmailSendCounts;
  waitlisted: EmailSendCounts;
  rejected: EmailSendCounts;
  announcement: EmailSendCounts;
}

export interface DecisionEmailStatsResponse {
  stats: DecisionEmailStats;
}

export interface SendDecisionEmailsPayload {
  mode: DecisionEmailMode;
  statuses?: DecidedStatus[];
  resend_all?: boolean;
}

export interface SendDecisionEmailsResponse {
  mode: DecisionEmailMode;
  queued: number;
  skipped: number;
}

export interface DecisionsReleasedResponse {
  released: boolean;
}
