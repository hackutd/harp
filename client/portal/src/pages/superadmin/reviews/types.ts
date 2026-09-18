import type { ApplicationStatus } from "@/pages/admin/all-applicants/types";

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

/**
 * Every application status an email list can be exported for. This is the
 * recognized counterpart to `DecidedStatus`: CSV export is deliberately not
 * limited to decided applicants, so draft/submitted lists can be downloaded.
 * Keep the send path (which uses `DecidedStatus`) separate from this.
 */
export type ExportStatus =
  | "draft"
  | "submitted"
  | "accepted"
  | "waitlisted"
  | "rejected";

/** All statuses a Super Admin may export applicant emails for. */
export const EXPORT_STATUSES: ExportStatus[] = [
  "draft",
  "submitted",
  "accepted",
  "waitlisted",
  "rejected",
];

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
