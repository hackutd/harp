import { getRequest } from "@/shared/lib/api";
import type { ApiResponse, ScheduleItem } from "@/types";

export interface ScheduleListResponse {
  schedule: ScheduleItem[];
}

export interface ScheduleDateRangeResponse {
  start_date: string | null;
  end_date: string | null;
  configured: boolean;
}

export async function getSchedule(
  signal?: AbortSignal,
): Promise<ApiResponse<ScheduleListResponse>> {
  return getRequest<ScheduleListResponse>("/schedule", "schedule", signal);
}

export async function getScheduleDateRange(
  signal?: AbortSignal,
): Promise<ApiResponse<ScheduleDateRangeResponse>> {
  return getRequest<ScheduleDateRangeResponse>(
    "/schedule/date-range",
    "schedule dates",
    signal,
  );
}
