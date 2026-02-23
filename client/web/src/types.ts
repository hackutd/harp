export type UserRole = "hacker" | "admin" | "super_admin";

export interface ShortAnswerQuestion {
  id: string;
  question: string;
  required: boolean;
  display_order: number;
}

export type ApplicationStatus =
  | "draft"
  | "submitted"
  | "accepted"
  | "rejected"
  | "waitlisted";

export type ReviewVote = "accept" | "waitlist" | "reject";

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
  first_name: string | null;
  last_name: string | null;
  email: string;
  age: number | null;
  university: string | null;
  major: string | null;
  country_of_residence: string | null;
  hackathons_attended_count: number | null;
}

export interface PendingReviewsResponse {
  reviews: Review[];
}

export interface ReviewNote {
  admin_id: string;
  admin_email: string;
  notes: string;
  created_at: string;
}

export interface NotesListResponse {
  notes: ReviewNote[];
}

export interface User {
  id: string;
  email: string;
  role: UserRole;
  profilePictureUrl?: string;
  createdAt: string;
  updatedAt: string;
}

export interface Application {
  id: string;
  user_id: string;
  status: ApplicationStatus;
  first_name: string | null;
  last_name: string | null;
  phone_e164: string | null;
  age: number | null;
  country_of_residence: string | null;
  gender: string | null;
  race: string | null;
  ethnicity: string | null;
  university: string | null;
  major: string | null;
  level_of_study: string | null;
  short_answer_responses: Record<string, string> | null;
  short_answer_questions: ShortAnswerQuestion[];
  hackathons_attended_count: number | null;
  software_experience_level: string | null;
  heard_about: string | null;
  shirt_size: string | null;
  dietary_restrictions: string[];
  accommodations: string | null;
  github: string | null;
  linkedin: string | null;
  website: string | null;
  ack_application: boolean;
  ack_mlh_coc: boolean;
  ack_mlh_privacy: boolean;
  opt_in_mlh_emails: boolean;
  submitted_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface ApiResponse<T = unknown> {
  status: number;
  data?: T;
  error?: string;
}

export interface Scan {
  id: string;
  userId: string;
  eventType: string;
  scannedAt: string;
  scannedBy: string;
}

// Lightweight application item from paginated admin list
export interface ApplicationListItem {
  id: string;
  user_id: string;
  email: string;
  status: ApplicationStatus;
  first_name: string | null;
  last_name: string | null;
  phone_e164: string | null;
  age: number | null;
  country_of_residence: string | null;
  gender: string | null;
  university: string | null;
  major: string | null;
  level_of_study: string | null;
  hackathons_attended_count: number | null;
  submitted_at: string | null;
  created_at: string;
  updated_at: string;
}

// Paginated response from admin applications endpoint
export interface ApplicationListResult {
  applications: ApplicationListItem[];
  next_cursor: string | null;
  prev_cursor: string | null;
  has_more: boolean;
}

// Application stats
export interface ApplicationStats {
  total_applications: number;
  submitted: number;
  accepted: number;
  rejected: number;
  waitlisted: number;
  draft: number;
  acceptance_rate: number;
}
