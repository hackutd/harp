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
