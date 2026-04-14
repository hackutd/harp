export type UserRole = "hacker" | "admin" | "super_admin";

export type FieldType =
  | "text"
  | "number"
  | "textarea"
  | "select"
  | "multi_select"
  | "checkbox"
  | "phone";

export interface ApplicationSchemaField {
  id: string;
  type: FieldType;
  label: string;
  required: boolean;
  section: string;
  section_label?: string;
  section_order?: number;
  display_order: number;
  options?: string[];
  validation?: Record<string, unknown>;
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
  hackathons_attended: number | null;
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
  responses: Record<string, unknown>;
  application_schema: ApplicationSchemaField[];
  resume_path: string | null;
  ai_percent: number | null;
  accept_votes: number;
  reject_votes: number;
  waitlist_votes: number;
  reviews_assigned: number;
  reviews_completed: number;
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
  accept_votes: number;
  reject_votes: number;
  waitlist_votes: number;
  reviews_assigned: number;
  reviews_completed: number;
  ai_percent: number | null;
  has_resume: boolean;
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
