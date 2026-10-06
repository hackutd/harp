import type { RSVPStatus, TravelStatus } from "@/types";

export type ApplicationStatus =
  | "draft"
  | "submitted"
  | "accepted"
  | "rejected"
  | "waitlisted";

export interface ApplicationListItem {
  id: string;
  user_id: string;
  email: string;
  status: ApplicationStatus;
  first_name: string | null;
  last_name: string | null;
  phone: string | null;
  age: number | null;
  country_of_residence: string | null;
  gender: string | null;
  university: string | null;
  major: string | null;
  level_of_study: string | null;
  hackathons_attended: number | null;
  submitted_at: string | null;
  created_at: string;
  updated_at: string;
  ai_percent: number | null;
  accept_votes: number;
  reject_votes: number;
  waitlist_votes: number;
  reviews_assigned: number;
  reviews_completed: number;
  has_resume: boolean;
  points: number;
  travel_status: TravelStatus;
  travel_yes_votes: number;
  travel_no_votes: number;
  travel_approved_amount_cents: number | null;
  /** One-shot hacker decisions; a submitted travel RSVP pins the travel status. */
  rsvp_status: RSVPStatus;
  travel_rsvp_status: RSVPStatus;
  rsvp_submitted_at: string | null;
  travel_rsvp_submitted_at: string | null;
  receipt_count: number;
  estimated_travel_cost_cents: number | null;
  /** First check-in scan; null until the hacker arrives at the event. */
  checked_in_at: string | null;
}

export interface ApplicationListResult {
  applications: ApplicationListItem[];
  next_cursor: string | null;
  prev_cursor: string | null;
  has_more: boolean;
}

export interface ApplicationStats {
  total_applications: number;
  submitted: number;
  accepted: number;
  rejected: number;
  waitlisted: number;
  draft: number;
  acceptance_rate: number;
  /** RSVP counts cover accepted applications only. */
  rsvp_pending: number;
  rsvp_confirmed: number;
  rsvp_declined: number;
  /** Everyone with a check-in scan, promoted walk-ins included. */
  checked_in: number;
  /** Accepted, RSVP confirmed, and never checked in. */
  no_shows: number;
}

/**
 * Which filter row the applicants page shows: application status (before the
 * event) or RSVP and check-in (around it). Only one applies at a time.
 */
export type FilterMode = "status" | "event";

/**
 * Event-day presets, shown in the "event" filter mode. Each maps to a combination
 * of the status, rsvp_status and checked_in list filters (see utils.ts).
 */
export type AttendanceView =
  | "rsvp_pending"
  | "rsvp_confirmed"
  | "rsvp_declined"
  | "checked_in"
  | "no_show";

export type ApplicationSortBy =
  | "created_at"
  | "accept_votes"
  | "reject_votes"
  | "waitlist_votes"
  | "travel_yes_votes";

export interface FetchParams {
  cursor?: string;
  status?: ApplicationStatus | null;
  travel_status?: TravelStatus;
  /** null clears a remembered filter; undefined keeps it. */
  rsvp_status?: RSVPStatus | null;
  travel_rsvp_status?: RSVPStatus;
  has_receipts?: boolean;
  travel_requested?: boolean;
  /** null clears a remembered filter; undefined keeps it. */
  checked_in?: boolean | null;
  direction?: "forward" | "backward";
  search?: string;
  sort_by?: ApplicationSortBy;
}
