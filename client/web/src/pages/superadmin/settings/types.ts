export interface ResetHackathonOptions {
  reset_applications: boolean;
  reset_scans: boolean;
  reset_schedule: boolean;
  reset_settings: boolean;
  reset_notifications: boolean;
}

export interface ResetHackathonResult {
  reset_applications: boolean;
  reset_scans: boolean;
  reset_schedule: boolean;
  reset_settings: boolean;
  reset_notifications: boolean;
  resumes_deleted: number;
}
