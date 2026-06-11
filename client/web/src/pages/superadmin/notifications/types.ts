import type { UserRole } from "@/types";

export interface ScheduledNotification {
  id: string;
  title: string;
  body: string;
  url: string | null;
  target_role: UserRole | null;
  scheduled_at: string;
  sent_at: string | null;
  recipient_count: number;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface ScheduledNotificationPayload {
  title: string;
  body: string;
  url: string | null;
  target_role: UserRole | null;
  scheduled_at: string;
}

export interface ScheduledNotificationListResponse {
  notifications: ScheduledNotification[];
}
