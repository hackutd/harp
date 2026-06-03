import type { ScheduledNotification } from "./types";

export const DEFAULT_SCHEDULE_LEAD_MS = 5 * 60 * 1000;
export const MIN_SCHEDULE_LEAD_MS = 60 * 1000;

export function sortScheduledNotifications(
  notifications: ScheduledNotification[],
): ScheduledNotification[] {
  return [...notifications].sort(
    (a, b) =>
      new Date(b.scheduled_at).getTime() - new Date(a.scheduled_at).getTime(),
  );
}

function roundUpToMinute(date: Date): Date {
  const rounded = new Date(date);
  if (rounded.getSeconds() > 0 || rounded.getMilliseconds() > 0) {
    rounded.setMinutes(rounded.getMinutes() + 1, 0, 0);
  }
  return rounded;
}

export function toLocalInputValue(iso: string): string {
  const d = new Date(iso);
  const tzOffsetMs = d.getTimezoneOffset() * 60_000;
  const local = new Date(d.getTime() - tzOffsetMs);
  return local.toISOString().slice(0, 16);
}

export function defaultScheduledLocal(): string {
  return toLocalInputValue(
    roundUpToMinute(
      new Date(Date.now() + DEFAULT_SCHEDULE_LEAD_MS),
    ).toISOString(),
  );
}

export function minimumScheduledLocal(): string {
  return toLocalInputValue(
    roundUpToMinute(new Date(Date.now() + MIN_SCHEDULE_LEAD_MS)).toISOString(),
  );
}

export function getScheduledAtError(value: string): string | null {
  if (!value) return "Choose a scheduled time.";

  const scheduled = new Date(value);
  if (Number.isNaN(scheduled.getTime())) {
    return "Choose a valid scheduled time.";
  }

  if (scheduled.getTime() < Date.now() + MIN_SCHEDULE_LEAD_MS) {
    return "Schedule at least 1 minute in the future.";
  }

  return null;
}

export function normalizeNotificationUrlInput(value: string): {
  error: string | null;
  url: string | null;
} {
  const trimmed = value.trim();
  if (!trimmed) return { error: null, url: null };

  if (trimmed.includes("\\")) {
    return {
      error: "Enter a same-origin path like /app.",
      url: null,
    };
  }

  if (trimmed.startsWith("//")) {
    return {
      error: "Enter a same-origin path like /app.",
      url: null,
    };
  }

  const isPath = trimmed.startsWith("/");
  const isAbsoluteHttp = /^https?:\/\//i.test(trimmed);
  if (!isPath && !isAbsoluteHttp) {
    return {
      error: "Enter a path starting with / or a same-origin URL.",
      url: null,
    };
  }

  try {
    const parsed = new URL(trimmed, window.location.origin);
    if (parsed.origin !== window.location.origin) {
      return {
        error: "Notification links must stay inside this portal.",
        url: null,
      };
    }

    return {
      error: null,
      url: `${parsed.pathname}${parsed.search}${parsed.hash}`,
    };
  } catch {
    return {
      error: "Enter a valid same-origin path.",
      url: null,
    };
  }
}
