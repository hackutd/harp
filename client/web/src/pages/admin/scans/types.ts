export type ScanTypeCategory =
  | "check_in"
  | "meal"
  | "swag"
  | "other"
  | "walk_in";

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
  scanned_by: string;
  points: number;
  scanned_at: string;
  created_at: string;
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

export interface PointsNameResponse {
  name: string;
}
