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

export interface PointsNameResult {
  name: string;
}
