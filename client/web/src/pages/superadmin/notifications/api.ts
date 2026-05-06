import {
  deleteRequest,
  getRequest,
  patchRequest,
  postRequest,
} from "@/shared/lib/api";
import type { ApiResponse } from "@/types";

import type {
  ScheduledNotification,
  ScheduledNotificationListResponse,
  ScheduledNotificationPayload,
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
