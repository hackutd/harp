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
import { sortScheduledNotifications } from "./utils";

interface FetchNotificationsOptions {
  signal?: AbortSignal;
  silent?: boolean;
}

export interface NotificationsState {
  notifications: ScheduledNotification[];
  loading: boolean;
  saving: boolean;

  fetch: (options?: FetchNotificationsOptions) => Promise<void>;
  create: (payload: ScheduledNotificationPayload) => Promise<boolean>;
  update: (
    id: string,
    payload: ScheduledNotificationPayload,
  ) => Promise<boolean>;
  remove: (id: string) => Promise<boolean>;
}

let fetchSeq = 0;

export const useNotificationsStore = create<NotificationsState>((set, get) => ({
  notifications: [],
  loading: false,
  saving: false,

  fetch: async (options = {}) => {
    const { signal, silent = false } = options;
    const requestId = ++fetchSeq;

    if (!silent) {
      set({ loading: true });
    }

    const res = await fetchScheduledNotifications(signal);
    const isLatest = requestId === fetchSeq;

    if (signal?.aborted) {
      if (!silent) set({ loading: false });
      return;
    }

    if (!isLatest) {
      if (!silent) set({ loading: false });
      return;
    }

    if (res.status === 200 && res.data) {
      set({
        notifications: sortScheduledNotifications(res.data.notifications),
        loading: false,
      });
    } else {
      if (!silent) {
        set({ loading: false });
        if (res.status !== 0) errorAlert(res, "Failed to load notifications");
      }
    }
  },

  create: async (payload) => {
    set({ saving: true });
    const res = await createScheduledNotification(payload);
    if (res.status === 201 && res.data) {
      const created = res.data;
      set((state) => ({
        notifications: sortScheduledNotifications([
          created,
          ...state.notifications,
        ]),
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
      const updated = res.data;
      set((state) => ({
        notifications: sortScheduledNotifications(
          state.notifications.map((n) => (n.id === id ? updated : n)),
        ),
        saving: false,
      }));
      toast.success("Notification updated");
      return true;
    }
    set({ saving: false });
    errorAlert(res, "Failed to update notification");
    if (res.status === 409) {
      await get().fetch({ silent: true });
    }
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
    if (res.status === 409) {
      await get().fetch({ silent: true });
    }
    return false;
  },
}));
