import { getRequest } from "@/shared/lib/api";
import type { ApiResponse, ScheduleItem } from "@/types";

export interface ScheduleListResponse {
  schedule: ScheduleItem[];
}

export async function getSchedule(
  signal?: AbortSignal,
): Promise<ApiResponse<ScheduleListResponse>> {
  return getRequest<ScheduleListResponse>("/schedule", "schedule", signal);
}
