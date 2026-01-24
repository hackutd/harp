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
  userId: string;
  status: ApplicationStatus;
  firstName: string;
  lastName: string;
  email: string;
  school: string;
  major: string;
  graduationYear: number;
  shirtSize?: string;
  dietaryRestrictions?: string;
  resume?: string;
  github?: string;
  linkedin?: string;
  createdAt: string;
  updatedAt: string;
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
