export type ScanTypeCategory =
  | "check_in"
  | "meal"
  | "swag"
  | "other"
  | "walk_in"
  | "shop";

export interface ScanType {
  name: string;
  display_name: string;
  category: ScanTypeCategory;
  is_active: boolean;
  points: number;
}

export interface Scan {
  id: string;
  user_id: string;
  scan_type: string;
  /** Null once the staff account that performed the scan is deleted. */
  scanned_by: string | null;
  points: number;
  scanned_at: string;
  created_at: string;
  /** Remaining points balance; present only on shop scans. */
  balance?: number;
  /** Hacker's meal group; assigned on check-in scans, echoed on others. */
  meal_group?: string;
}

export interface ScanStat {
  scan_type: string;
  count: number;
}

export interface ScanTypesResponse {
  scan_types: ScanType[];
}

export interface ScanStatsResponse {
  stats: ScanStat[];
}

export interface ScansResponse {
  scans: Scan[];
}
