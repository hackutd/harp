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
  send_push?: boolean;
}

export interface SendDecisionEmailsResponse {
  mode: DecisionEmailMode;
  queued: number;
  skipped: number;
  push_recipients: number;
}

/** Who a decision release covers, by submission time against the priority deadline. */
export type DecisionReleaseAudience = "priority" | "non_priority" | "everyone";

/** Emails sent to a release's applicants once it is saved. */
export type DecisionReleaseEmail = "none" | DecisionEmailMode;

/** One decision release (a "wave"): what it covered and who it published. */
export interface DecisionRelease {
  id: string;
  released_by: string | null;
  released_by_email: string | null;
  audience: DecisionReleaseAudience;
  statuses: DecidedStatus[];
  /** The priority deadline the audience was resolved against. */
  priority_deadline: string | null;
  released_count: number;
  created_at: string;
  undone_at: string | null;
  undone_by_email: string | null;
  /** Applicants emailed since the release went out; undo cannot recall these. */
  emailed_count: number;
}

export interface DecisionReleasesResponse {
  releases: DecisionRelease[];
}

/** What a release would do to the applicants in one status. */
export interface DecisionReleaseCounts {
  /** Never had a decision released. */
  new: number;
  /** Had a different decision released. */
  changed: number;
  /** Already see this decision, but their travel decision changed since. */
  travel_only: number;
  /** Already see exactly this decision. */
  unchanged: number;
  /** The changed applicants who already RSVP'd to what they see. */
  rsvp_changed: number;
}

export interface DecisionReleasePreviewResponse {
  audience: DecisionReleaseAudience;
  priority_deadline: string | null;
  preview: {
    by_status: Record<DecidedStatus, DecisionReleaseCounts>;
    /** Applicants in the audience with no decision yet, left out of any release. */
    under_review: number;
  };
}

export interface CreateDecisionReleasePayload {
  audience: DecisionReleaseAudience;
  statuses: DecidedStatus[];
  email: DecisionReleaseEmail;
  send_push: boolean;
}

export interface CreateDecisionReleaseResponse {
  release: DecisionRelease;
  emails?: SendDecisionEmailsResponse;
  /** Set when emails were asked for but did not start; the release stands. */
  email_error?: string;
}
