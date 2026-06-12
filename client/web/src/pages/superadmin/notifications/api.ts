import {
  deleteRequest,
  getRequest,
  patchRequest,
  postRequest,
} from "@/shared/lib/api";
import type { ApiResponse } from "@/types";

import type {
  GenerateScheduleNotificationsPayload,
  ScheduledNotification,
  ScheduledNotificationListResponse,
  ScheduledNotificationPayload,
  ScheduleListResponse,
  ScheduleNotificationGenerationResult,
} from "./types";

export async function fetchScheduledNotifications(
  signal?: AbortSignal,
): Promise<ApiResponse<ScheduledNotificationListResponse>> {
  return getRequest<ScheduledNotificationListResponse>(
    "/superadmin/notifications",
    "scheduled notifications",
    signal,
  );
}

export async function createScheduledNotification(
  payload: ScheduledNotificationPayload,
  signal?: AbortSignal,
): Promise<ApiResponse<ScheduledNotification>> {
  return postRequest<ScheduledNotification>(
    "/superadmin/notifications",
    payload,
    "scheduled notification",
    signal,
  );
}

export async function updateScheduledNotification(
  id: string,
  payload: ScheduledNotificationPayload,
  signal?: AbortSignal,
): Promise<ApiResponse<ScheduledNotification>> {
  return patchRequest<ScheduledNotification>(
    `/superadmin/notifications/${id}`,
    payload,
    "scheduled notification",
    signal,
  );
}

export async function fetchScheduleForNotifications(
  signal?: AbortSignal,
): Promise<ApiResponse<ScheduleListResponse>> {
  return getRequest<ScheduleListResponse>(
    "/admin/schedule",
    "schedule",
    signal,
  );
}

export async function generateNotificationsFromSchedule(
  payload: GenerateScheduleNotificationsPayload,
  signal?: AbortSignal,
): Promise<ApiResponse<ScheduleNotificationGenerationResult>> {
  return postRequest<ScheduleNotificationGenerationResult>(
    "/superadmin/notifications/from-schedule",
    payload,
    "schedule notifications",
    signal,
  );
}

export async function deleteScheduledNotification(
  id: string,
  signal?: AbortSignal,
): Promise<ApiResponse<unknown>> {
  return deleteRequest<unknown>(
    `/superadmin/notifications/${id}`,
    "scheduled notification",
    signal,
  );
}
