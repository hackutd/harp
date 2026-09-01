import type { ApplicationListItem } from "@/pages/admin/all-applicants/types";

export type FormKey = "application" | "rsvp" | "travel";

export interface FormAvailability {
  enabled: boolean;
  due_date?: string;
}

export interface ApplicationFormStats {
  started: number;
  drafts: number;
  submitted: number;
  awaiting_decision: number;
  accepted: number;
  rejected: number;
  waitlisted: number;
  completion_rate: number;
  latest_submission: string | null;
}

export interface RSVPFormStats {
  eligible: number;
  pending: number;
  confirmed: number;
  declined: number;
  response_rate: number;
  latest_response: string | null;
}

export interface TravelFormStats {
  requested: number;
  decision_pending: number;
  approved: number;
  rejected: number;
  form_eligible: number;
  form_pending: number;
  form_submitted: number;
  form_declined: number;
  people_with_receipts: number;
  receipt_files: number;
  requested_estimate_cents: number;
  approved_amount_cents: number;
  latest_travel_form_submission: string | null;
}

export interface FormsOverviewData {
  application: FormAvailability;
  rsvp: FormAvailability;
  travel: FormAvailability;
  stats: {
    applications: ApplicationFormStats;
    rsvp: RSVPFormStats;
    travel: TravelFormStats;
  };
}

export interface FormsResponsePage {
  applications: ApplicationListItem[];
  next_cursor: string | null;
  prev_cursor: string | null;
  has_more: boolean;
}

export type FormDetailTab = "overview" | "responses" | "builder" | "settings";
