// Application Review feature types

import type { TravelStatus, UserRole } from "@/types";

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

/** The bare review row returned by PUT /admin/reviews/{id} (no applicant details). */
export type ReviewRecord = Pick<
  Review,
  | "id"
  | "admin_id"
  | "application_id"
  | "vote"
  | "travel_vote"
  | "notes"
  | "assigned_at"
  | "reviewed_at"
  | "created_at"
  | "updated_at"
>;

export interface ReviewResponse {
  review: ReviewRecord;
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

/** One admin's row on the review leaderboard. Names are null for admins who never applied. */
export interface ReviewerStats {
  admin_id: string;
  email: string;
  first_name: string | null;
  last_name: string | null;
  profile_picture_url: string | null;
  role: UserRole;
  /** Admins with the same completed count share a rank. */
  rank: number;
  completed: number;
  pending: number;
  last_reviewed_at: string | null;
}

export interface ReviewLeaderboardResponse {
  reviewers: ReviewerStats[];
}

/** POST /admin/reviews/claim: how many were claimed, plus the admin's new queue. */
export interface ClaimReviewsResponse {
  claimed: number;
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
