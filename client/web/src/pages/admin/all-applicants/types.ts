export type ApplicationStatus = 'draft' | 'submitted' | 'accepted' | 'rejected' | 'waitlisted';

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
}

export interface FetchParams {
  cursor?: string;
  status?: ApplicationStatus | null;
  direction?: 'forward' | 'backward';
}
