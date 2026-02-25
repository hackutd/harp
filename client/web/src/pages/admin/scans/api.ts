import { getRequest, postRequest } from "@/shared/lib/api";
import type { ApiResponse } from "@/types";

import type { Scan, ScanStatsResponse, ScanTypesResponse } from "./types";

export async function fetchScanTypes(
  signal?: AbortSignal,
): Promise<ApiResponse<ScanTypesResponse>> {
  return getRequest<ScanTypesResponse>(
    "/admin/scans/types",
    "scan types",
    signal,
  );
}

export async function createScan(
  userId: string,
  scanType: string,
  signal?: AbortSignal,
): Promise<ApiResponse<Scan>> {
  return postRequest<Scan>(
    "/admin/scans",
    { user_id: userId, scan_type: scanType },
    "scan",
    signal,
  );
}

export async function fetchScanStats(
  signal?: AbortSignal,
): Promise<ApiResponse<ScanStatsResponse>> {
  return getRequest<ScanStatsResponse>(
    "/admin/scans/stats",
    "scan stats",
    signal,
  );
}
