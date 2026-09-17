import { getRequest } from "@/shared/lib/api";
import type { ApiResponse, NotificationFeedItem } from "@/types";

export interface NotificationFeedResponse {
  notifications: NotificationFeedItem[];
}

export async function getNotificationFeed(
  signal?: AbortSignal,
): Promise<ApiResponse<NotificationFeedResponse>> {
  return getRequest<NotificationFeedResponse>(
    "/notifications/feed",
    "notifications",
    signal,
  );
}
