import { afterEach, describe, expect, it, vi } from "vitest";

import type { ScheduledNotification } from "./types";
import {
  DEFAULT_SCHEDULE_LEAD_MS,
  defaultScheduledLocal,
  getScheduledAtError,
  MIN_SCHEDULE_LEAD_MS,
  minimumScheduledLocal,
  normalizeNotificationUrlInput,
  sortScheduledNotifications,
  toLocalInputValue,
} from "./utils";

function notification(
  scheduledAt: string,
  id = scheduledAt,
): ScheduledNotification {
  return {
    id,
    title: `N ${id}`,
    body: "",
    url: null,
    target_role: null,
    scheduled_at: scheduledAt,
    sent_at: null,
    recipient_count: 0,
    schedule_id: null,
    claimed_at: null,
    attempts: 0,
    failed_at: null,
    last_error: null,
    created_by: "",
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
  };
}

afterEach(() => {
  vi.useRealTimers();
});

describe("sortScheduledNotifications", () => {
  it("sorts newest scheduled time first without mutating the input", () => {
    const input = [
      notification("2026-03-14T15:00:00Z"),
      notification("2026-03-14T18:00:00Z", "later"),
      notification("2026-03-14T16:00:00Z", "middle"),
    ];
    const sorted = sortScheduledNotifications(input);
    expect(sorted.map((n) => n.id)).toEqual(["later", "middle", input[0].id]);
    expect(input.map((n) => n.id)).not.toEqual(sorted.map((n) => n.id));
  });

  it("returns an empty array unchanged", () => {
    expect(sortScheduledNotifications([])).toEqual([]);
  });
});

describe("toLocalInputValue", () => {
  // Tests run under TZ=America/Chicago (pinned in vitest.config.ts).
  it.each([
    ["a CDT instant", "2026-03-14T15:30:00Z", "2026-03-14T10:30"],
    ["a CST instant", "2026-01-15T15:30:00Z", "2026-01-15T09:30"],
    [
      "an instant on the previous local day",
      "2026-03-15T03:00:00Z",
      "2026-03-14T22:00",
    ],
  ])("converts %s to local wall time", (_label, iso, expected) => {
    expect(toLocalInputValue(iso)).toBe(expected);
  });
});

describe("default and minimum scheduled times", () => {
  it("rounds the lead time up to the next whole minute", () => {
    vi.setSystemTime(new Date("2026-03-14T15:00:30Z")); // 10:00:30 CDT
    expect(defaultScheduledLocal()).toBe("2026-03-14T10:06");
    expect(minimumScheduledLocal()).toBe("2026-03-14T10:02");
  });

  it("keeps an exact minute as is", () => {
    vi.setSystemTime(new Date("2026-03-14T15:00:00Z"));
    expect(defaultScheduledLocal()).toBe("2026-03-14T10:05");
    expect(minimumScheduledLocal()).toBe("2026-03-14T10:01");
  });

  it("offers a minimum that getScheduledAtError accepts", () => {
    vi.setSystemTime(new Date("2026-03-14T15:00:30Z"));
    expect(getScheduledAtError(minimumScheduledLocal())).toBeNull();
  });
});

describe("getScheduledAtError (minimum future window)", () => {
  it.each([
    ["empty value", "", "Choose a scheduled time."],
    ["malformed value", "gibberish", "Choose a valid scheduled time."],
    [
      "past time",
      "2020-01-01T00:00",
      "Schedule at least 1 minute in the future.",
    ],
  ])("rejects %s", (_label, value, expected) => {
    expect(getScheduledAtError(value)).toBe(expected);
  });

  it("accepts a time beyond the minimum future window", () => {
    vi.setSystemTime(new Date("2026-03-14T12:00:00Z"));
    expect(getScheduledAtError("2026-03-14T13:00")).toBeNull();
  });

  it("enforces MIN_SCHEDULE_LEAD_MS of at least one minute", () => {
    expect(MIN_SCHEDULE_LEAD_MS).toBeGreaterThanOrEqual(60 * 1000);
    expect(DEFAULT_SCHEDULE_LEAD_MS).toBeGreaterThan(MIN_SCHEDULE_LEAD_MS);
  });
});

describe("normalizeNotificationUrlInput", () => {
  const origin = window.location.origin;

  it.each([
    ["same-origin path", "/app", "/app"],
    ["path with query and hash", "/app?tab=2#top", "/app?tab=2#top"],
    ["full same-origin URL", `${origin}/reviews?id=7`, "/reviews?id=7"],
    ["root path", "/", "/"],
  ])("accepts %s", (_label, input, expected) => {
    expect(normalizeNotificationUrlInput(input)).toEqual({
      error: null,
      url: expected,
    });
  });

  it("allows empty input as 'no link'", () => {
    expect(normalizeNotificationUrlInput("   ")).toEqual({
      error: null,
      url: null,
    });
  });

  it.each([
    ["cross-origin URL", "https://evil.example.com/app"],
    ["protocol-relative URL", "//evil.example.com/app"],
    ["backslash-containing path", "/app\\..\\admin"],
    ["javascript pseudo-scheme", "javascript:alert(1)"],
    ["malformed garbage", "::::"],
  ])("rejects unsafe %s", (_label, input) => {
    const result = normalizeNotificationUrlInput(input);
    expect(result.error).not.toBeNull();
    expect(result.url).toBeNull();
  });

  it("requires a leading / or http(s) scheme", () => {
    expect(normalizeNotificationUrlInput("app")?.error).toContain(
      "starting with /",
    );
  });
});
