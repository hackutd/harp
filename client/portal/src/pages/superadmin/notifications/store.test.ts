import { beforeEach, describe, expect, it, vi } from "vitest";

import { useNotificationsStore } from "./store";
import type {
  ScheduledNotification,
  ScheduledNotificationPayload,
} from "./types";

const api = vi.hoisted(() => ({
  createScheduledNotification: vi.fn(),
  deleteScheduledNotification: vi.fn(),
  fetchScheduledNotifications: vi.fn(),
  generateNotificationsFromSchedule: vi.fn(),
  updateScheduledNotification: vi.fn(),
}));

vi.mock("./api", () => ({
  createScheduledNotification: api.createScheduledNotification,
  deleteScheduledNotification: api.deleteScheduledNotification,
  fetchScheduledNotifications: api.fetchScheduledNotifications,
  generateNotificationsFromSchedule: api.generateNotificationsFromSchedule,
  updateScheduledNotification: api.updateScheduledNotification,
}));

const toast = vi.hoisted(() => ({
  success: vi.fn(),
  info: vi.fn(),
  error: vi.fn(),
}));
vi.mock("sonner", () => ({ toast }));

const errorAlert = vi.hoisted(() => vi.fn());
vi.mock("@/shared/lib/api", () => ({ errorAlert }));

function notification(
  id: string,
  overrides: Partial<ScheduledNotification> = {},
): ScheduledNotification {
  return {
    id,
    title: `N ${id}`,
    body: "body",
    url: null,
    target_role: null,
    scheduled_at: "2026-03-14T15:00:00Z",
    sent_at: null,
    recipient_count: 0,
    created_by: "admin",
    created_at: "2026-03-14T15:00:00Z",
    updated_at: "2026-03-14T15:00:00Z",
    ...overrides,
  };
}

const payload: ScheduledNotificationPayload = {
  title: "Reminder",
  body: "Don't forget",
  url: null,
  target_role: "hacker",
  scheduled_at: "2026-03-14T16:00:00Z",
};

const listResult = { notifications: [notification("1"), notification("2")] };

beforeEach(() => {
  useNotificationsStore.setState({
    notifications: [],
    loading: false,
    saving: false,
  });
  vi.clearAllMocks();
});

describe("notification store: fetch", () => {
  it("loads sorted notifications and toggles loading", async () => {
    api.fetchScheduledNotifications.mockResolvedValue({
      status: 200,
      data: listResult,
    });
    const p = useNotificationsStore.getState().fetch();
    expect(useNotificationsStore.getState().loading).toBe(true);
    await p;
    const s = useNotificationsStore.getState();
    expect(s.loading).toBe(false);
    expect(s.notifications.map((n) => n.id)).toEqual(["1", "2"]);
  });

  it("swallows silent fetches without toggling loading or alerting", async () => {
    api.fetchScheduledNotifications.mockResolvedValue({ status: 500 });
    await useNotificationsStore.getState().fetch({ silent: true });
    expect(useNotificationsStore.getState().loading).toBe(false);
    expect(errorAlert).not.toHaveBeenCalled();
  });
});

describe("notification store: create / update / delete", () => {
  it("prepends a created notification and toasts", async () => {
    api.createScheduledNotification.mockResolvedValue({
      status: 201,
      data: notification("9"),
    });
    const ok = await useNotificationsStore.getState().create(payload);
    expect(ok).toBe(true);
    expect(
      useNotificationsStore.getState().notifications.map((n) => n.id),
    ).toEqual(["9"]);
    expect(useNotificationsStore.getState().saving).toBe(false);
    expect(toast.success).toHaveBeenCalled();
  });

  it("returns false and alerts on failed create", async () => {
    api.createScheduledNotification.mockResolvedValue({ status: 500 });
    const ok = await useNotificationsStore.getState().create(payload);
    expect(ok).toBe(false);
    expect(errorAlert).toHaveBeenCalled();
    expect(useNotificationsStore.getState().saving).toBe(false);
  });

  it("replaces a notification on update", async () => {
    useNotificationsStore.setState({ notifications: [notification("1")] });
    api.updateScheduledNotification.mockResolvedValue({
      status: 200,
      data: notification("1", { title: "Renamed" }),
    });
    const ok = await useNotificationsStore.getState().update("1", payload);
    expect(ok).toBe(true);
    expect(useNotificationsStore.getState().notifications[0].title).toBe(
      "Renamed",
    );
    expect(useNotificationsStore.getState().saving).toBe(false);
  });
});

describe("notification store: conflict handling refreshes the list", () => {
  it("re-fetches silently on a 409 update conflict", async () => {
    useNotificationsStore.setState({ notifications: [notification("1")] });
    const refreshed = [
      notification("1"),
      notification("2", { title: "Server wins" }),
    ];
    api.updateScheduledNotification.mockResolvedValue({ status: 409 });
    api.fetchScheduledNotifications.mockResolvedValue({
      status: 200,
      data: { notifications: refreshed },
    });

    const ok = await useNotificationsStore.getState().update("1", payload);

    expect(ok).toBe(false);
    expect(api.fetchScheduledNotifications).toHaveBeenCalled();
    expect(
      useNotificationsStore.getState().notifications.map((n) => n.title),
    ).toContain("Server wins");
  });

  it("refreshes the list on a 409 delete conflict", async () => {
    useNotificationsStore.setState({ notifications: [notification("1")] });
    const refreshed = [notification("1"), notification("3")];
    api.deleteScheduledNotification.mockResolvedValue({ status: 409 });
    api.fetchScheduledNotifications.mockResolvedValue({
      status: 200,
      data: { notifications: refreshed },
    });

    const ok = await useNotificationsStore.getState().remove("1");

    expect(ok).toBe(false);
    expect(api.fetchScheduledNotifications).toHaveBeenCalled();
    expect(useNotificationsStore.getState().notifications).toHaveLength(2);
  });

  it("removes a notification on delete", async () => {
    useNotificationsStore.setState({
      notifications: [notification("1"), notification("2")],
    });
    api.deleteScheduledNotification.mockResolvedValue({ status: 204 });
    const ok = await useNotificationsStore.getState().remove("1");
    expect(ok).toBe(true);
    expect(
      useNotificationsStore.getState().notifications.map((n) => n.id),
    ).toEqual(["2"]);
  });
});

describe("notification store: generation", () => {
  it("refreshes the list and reports created counts after generation", async () => {
    api.generateNotificationsFromSchedule.mockResolvedValue({
      status: 201,
      data: { created: 3, skipped: 1 },
    });
    api.fetchScheduledNotifications.mockResolvedValue({
      status: 200,
      data: listResult,
    });

    const ok = await useNotificationsStore.getState().generateFromSchedule({
      lead_minutes: 5,
      target_role: "hacker",
    });

    expect(ok).toBe(true);
    expect(api.fetchScheduledNotifications).toHaveBeenCalled();
    expect(toast.success).toHaveBeenCalledWith(
      "Scheduled 3 reminders (1 skipped)",
    );
    expect(useNotificationsStore.getState().saving).toBe(false);
  });

  it("reports an info toast when nothing was created", async () => {
    api.generateNotificationsFromSchedule.mockResolvedValue({
      status: 201,
      data: { created: 0, skipped: 0 },
    });
    api.fetchScheduledNotifications.mockResolvedValue({
      status: 200,
      data: listResult,
    });

    const ok = await useNotificationsStore.getState().generateFromSchedule({
      lead_minutes: 5,
      target_role: null,
    });
    expect(ok).toBe(true);
    expect(toast.info).toHaveBeenCalled();
  });
});
