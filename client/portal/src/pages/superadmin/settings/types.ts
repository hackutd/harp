export interface ResetHackathonOptions {
  reset_applications: boolean;
  reset_scans: boolean;
  reset_scan_types: boolean;
  reset_schedule: boolean;
  reset_settings: boolean;
  reset_notifications: boolean;
  reset_sponsors: boolean;
  reset_faqs: boolean;
  reset_config: boolean;
}

export interface ResetHackathonResult extends ResetHackathonOptions {
  resumes_deleted: number;
  receipts_deleted: number;
}

export interface MealGroupsResult {
  groups: string[];
}

export interface MealGroupStatsResult {
  stats: Record<string, number>;
}

export interface HackerPackURLResult {
  url: string;
}

export interface URLSettingResult {
  url: string;
}

export interface PointsNameResult {
  name: string;
}

export interface PointsEnabledResult {
  enabled: boolean;
}

export interface HackathonNameResult {
  name: string;
}

export interface EmailSettingResult {
  email: string;
}

export interface FromNameResult {
  name: string;
}

export interface DateSettingResult {
  date: string;
  configured: boolean;
}

export interface HackathonDateRangeResult {
  start_date: string | null;
  end_date: string | null;
  configured: boolean;
}

export interface OnboardingStatus {
  hackathon_name: boolean;
  hackathon_date_range: boolean;
  application_due_date: boolean;
  contact_email: boolean;
  from_email: boolean;
  complete: boolean;
}

// Every field the onboarding form collects. Dates are "YYYY-MM-DD".
export interface OnboardingValues {
  hackathon_name: string;
  start_date: string;
  end_date: string;
  application_due_date: string;
  contact_email: string;
  from_email: string;
  from_name: string;
  privacy_policy_url: string;
  terms_url: string;
}
