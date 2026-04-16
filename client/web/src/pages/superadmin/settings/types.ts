export interface ResetHackathonOptions {
  reset_applications: boolean;
  reset_scans: boolean;
  reset_schedule: boolean;
  reset_settings: boolean;
}

export interface ResetHackathonResult {
  reset_applications: boolean;
  reset_scans: boolean;
  reset_schedule: boolean;
  reset_settings: boolean;
  resumes_deleted: number;
}
