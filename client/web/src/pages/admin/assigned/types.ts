// Application Review feature types

export type ReviewVote = 'accept' | 'waitlist' | 'reject';

export interface Review {
  id: string;
  admin_id: string;
  application_id: string;
  vote: ReviewVote | null;
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
  hackathons_attended_count: number | null;
}

export interface ReviewNote {
  admin_id: string;
  admin_email: string;
  notes: string;
  created_at: string;
}

export interface PendingReviewsResponse {
  reviews: Review[];
}

export interface NotesListResponse {
  notes: ReviewNote[];
}

export interface SubmitVotePayload {
  vote: ReviewVote;
  notes?: string;
}
