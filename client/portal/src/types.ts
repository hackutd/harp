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

export type RSVPStatus = "pending" | "confirmed" | "declined";

export type TravelStatus =
  | "not_requested"
  | "pending"
  | "approved"
  | "rejected";

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
  /** Embedded on GET /applications/me; absent on mutation responses. */
  application_schema?: ApplicationSchemaField[];
  /** Total scan points; populated on read endpoints. */
  points?: number;
  /** Assigned at check-in; null until the hacker has checked in. */
  meal_group: string | null;
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
  /** RSVP decision for accepted hackers; "pending" until they claim/decline their spot. */
  rsvp_status: RSVPStatus;
  rsvp_responses: Record<string, unknown>;
  rsvp_submitted_at: string | null;
  /** Travel reimbursement review state; "pending" once submitted with the travel opt-in. */
  travel_status: TravelStatus;
  travel_yes_votes: number;
  travel_no_votes: number;
  /** Organizer-approved commitment; distinct from the requested estimate. */
  travel_approved_amount_cents: number | null;
  /** Travel RSVP (proof of travel) for hackers with approved travel; "pending" until they submit. */
  travel_rsvp_status: RSVPStatus;
  travel_rsvp_responses: Record<string, unknown>;
  travel_rsvp_submitted_at: string | null;
  travel_receipt_paths: string[] | null;
}

export interface ScheduleItem {
  id: string;
  event_name: string;
  description: string;
  start_time: string;
  end_time: string;
  location: string;
  tags: string[];
  created_at: string;
  updated_at: string;
}

export interface NotificationFeedItem {
  id: string;
  title: string;
  body: string;
  url: string | null;
  target_role: UserRole | null;
  scheduled_at: string;
  sent_at: string | null;
  recipient_count: number;
  schedule_id: string | null;
  /** Null once the author's account is deleted. */
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface HackerLink {
  id: string;
  label: string;
  url: string;
  icon: string;
  display_order: number;
  created_at: string;
  updated_at: string;
}

export interface HackerLinkListResponse {
  hacker_links: HackerLink[];
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
  points: number;
  travel_status: TravelStatus;
  travel_yes_votes: number;
  travel_no_votes: number;
  travel_approved_amount_cents: number | null;
  rsvp_status: RSVPStatus;
  travel_rsvp_status: RSVPStatus;
  rsvp_submitted_at: string | null;
  travel_rsvp_submitted_at: string | null;
  receipt_count: number;
  estimated_travel_cost_cents: number | null;
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
