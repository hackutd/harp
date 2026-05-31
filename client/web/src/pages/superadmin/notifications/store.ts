import { toast } from "sonner";
import { create } from "zustand";

import { errorAlert } from "@/shared/lib/api";

import {
  createScheduledNotification,
  deleteScheduledNotification,
  fetchScheduledNotifications,
  updateScheduledNotification,
} from "./api";
import type {
  ScheduledNotification,
  ScheduledNotificationPayload,
} from "./types";

export interface NotificationsState {
  notifications: ScheduledNotification[];
  loading: boolean;
  saving: boolean;

  fetch: (signal?: AbortSignal) => Promise<void>;
  create: (payload: ScheduledNotificationPayload) => Promise<boolean>;
  update: (
    id: string,
    payload: ScheduledNotificationPayload,
  ) => Promise<boolean>;
  remove: (id: string) => Promise<boolean>;
}

export const useNotificationsStore = create<NotificationsState>((set) => ({
  notifications: [],
  loading: false,
  saving: false,

  fetch: async (signal?: AbortSignal) => {
    set({ loading: true });
    const res = await fetchScheduledNotifications(signal);
    if (signal?.aborted) return;

    if (res.status === 200 && res.data) {
      set({ notifications: res.data.notifications, loading: false });
    } else {
      set({ loading: false });
      if (res.status !== 0) errorAlert(res, "Failed to load notifications");
    }
  },

  create: async (payload) => {
    set({ saving: true });
    const res = await createScheduledNotification(payload);
    if (res.status === 201 && res.data) {
      const created = res.data;
      set((state) => ({
        notifications: [created, ...state.notifications],
        saving: false,
      }));
      toast.success("Notification scheduled");
      return true;
    }
    set({ saving: false });
    errorAlert(res, "Failed to schedule notification");
    return false;
  },

  update: async (id, payload) => {
    set({ saving: true });
    const res = await updateScheduledNotification(id, payload);
    if (res.status === 200 && res.data) {
      // patchRequest returns the raw envelope; unwrap if present.
      const raw = res.data as
        | ScheduledNotification
        | { data: ScheduledNotification };
      const updated = "data" in raw ? raw.data : (raw as ScheduledNotification);
      set((state) => ({
        notifications: state.notifications.map((n) =>
          n.id === id ? updated : n,
        ),
        saving: false,
      }));
      toast.success("Notification updated");
      return true;
    }
    set({ saving: false });
    errorAlert(res, "Failed to update notification");
    return false;
  },

  remove: async (id) => {
    set({ saving: true });
    const res = await deleteScheduledNotification(id);
    if (res.status === 204) {
      set((state) => ({
        notifications: state.notifications.filter((n) => n.id !== id),
        saving: false,
      }));
      toast.success("Notification deleted");
      return true;
    }
    set({ saving: false });
    errorAlert(res, "Failed to delete notification");
    return false;
  },
}));
