// Shared TypeScript interfaces and types

export type UserRole = 'hacker' | 'admin' | 'super_admin';

export type ApplicationStatus =
  | 'pending'
  | 'in_review'
  | 'accepted'
  | 'rejected'
  | 'waitlisted';

export interface User {
  id: string;
  email: string;
  role: UserRole;
  createdAt: string;
  updatedAt: string;
}

export interface Application {
  id: string;
  user_id: string;
  status: BackendApplicationStatus;
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
  why_attend: string | null;
  hackathons_learned: string | null;
  first_hackathon_goals: string | null;
  looking_forward: string | null;
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

// Backend application status values (used in admin list)
export type BackendApplicationStatus =
  | 'draft'
  | 'submitted'
  | 'accepted'
  | 'rejected'
  | 'waitlisted';

// Lightweight application item from paginated admin list
export interface ApplicationListItem {
  id: string;
  user_id: string;
  email: string;
  status: BackendApplicationStatus;
  first_name: string | null;
  last_name: string | null;
  university: string | null;
  submitted_at: string | null;
  created_at: string;
}

// Paginated response from admin applications endpoint
export interface ApplicationListResult {
  applications: ApplicationListItem[];
  next_cursor: string | null;
  prev_cursor: string | null;
  has_more: boolean;
}
