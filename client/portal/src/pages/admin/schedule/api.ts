import {
  deleteRequest,
  getRequest,
  postRequest,
  putRequest,
} from "@/shared/lib/api";
import type { ApiResponse } from "@/types";

export interface CreateSchedulePayload {
  event_name: string;
  description: string;
  start_time: string;
  end_time: string;
  location: string;
  tags: string[];
}

export interface ScheduleResponseItem {
  id: string;
  event_name: string;
  description: string;
  start_time: string;
  end_time: string;
  location: string;
  tags: string[];
  created_at: string;
  updated_at: string;
}

export interface ScheduleItemResponse {
  schedule: ScheduleResponseItem;
}

export interface ScheduleListResponse {
  schedule: ScheduleResponseItem[];
}

export interface HackathonDateRangeResponse {
  start_date: string | null;
  end_date: string | null;
  configured: boolean;
}

export async function createScheduleItem(
  payload: CreateSchedulePayload,
  signal?: AbortSignal,
): Promise<ApiResponse<ScheduleItemResponse>> {
  return postRequest<ScheduleItemResponse>(
    "/admin/schedule",
    payload,
    "schedule item",
    signal,
  );
}

export async function updateScheduleItem(
  id: string,
  payload: CreateSchedulePayload,
  signal?: AbortSignal,
): Promise<ApiResponse<ScheduleItemResponse>> {
  return putRequest<ScheduleItemResponse>(
    `/admin/schedule/${id}`,
    payload,
    "schedule item",
    signal,
  );
}

export async function deleteScheduleItem(
  id: string,
  signal?: AbortSignal,
): Promise<ApiResponse<unknown>> {
  return deleteRequest<unknown>(
    `/admin/schedule/${id}`,
    "schedule item",
    signal,
  );
}

export async function fetchScheduleItems(
  signal?: AbortSignal,
): Promise<ApiResponse<ScheduleListResponse>> {
  return getRequest<ScheduleListResponse>(
    "/admin/schedule",
    "schedule",
    signal,
  );
}

export async function fetchScheduleDateRange(
  signal?: AbortSignal,
): Promise<ApiResponse<HackathonDateRangeResponse>> {
  return getRequest<HackathonDateRangeResponse>(
    "/admin/schedule/date-range",
    "schedule date range",
    signal,
  );
}
