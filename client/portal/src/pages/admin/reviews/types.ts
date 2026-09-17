// Application Review feature types

import type { TravelStatus } from "@/types";

export type ReviewVote = "accept" | "waitlist" | "reject";

export interface Review {
  id: string;
  admin_id: string;
  application_id: string;
  vote: ReviewVote | null;
  travel_vote: boolean | null;
  notes: string | null;
  assigned_at: string;
  reviewed_at: string | null;
  created_at: string;
  updated_at: string;
  // Embedded application data (included in pending reviews)
  first_name: string | null;
  last_name: string | null;
  email: string;
  age: number | null;
  university: string | null;
  major: string | null;
  country_of_residence: string | null;
  hackathons_attended: number | null;
  travel_status: TravelStatus;
}

export interface ReviewNote {
  admin_id: string;
  admin_email: string;
  notes: string;
  created_at: string;
}

export interface ReviewsListResponse {
  reviews: Review[];
}

export interface NotesListResponse {
  notes: ReviewNote[];
}

export interface SubmitVotePayload {
  vote: ReviewVote;
  /** Required when the applicant requested travel reimbursement; omitted otherwise. */
  travel_vote?: boolean;
  notes?: string;
}
