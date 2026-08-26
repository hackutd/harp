import { afterEach, describe, expect, it, vi } from "vitest";

import type { ScheduledNotification } from "./types";
import {
  DEFAULT_SCHEDULE_LEAD_MS,
  MIN_SCHEDULE_LEAD_MS,
  getScheduledAtError,
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
  it("converts an ISO instant to a local datetime-local input value", () => {
    // Round-trips through local wall time regardless of host zone.
    const iso = "2026-03-14T15:30:00Z";
    const value = toLocalInputValue(iso);
    expect(value).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/);
    // Converting back with the same zone offset must recover the instant.
    const parsed = new Date(value);
    const offsetShift = new Date(iso).getTime() - parsed.getTime();
    expect(Math.abs(offsetShift) % 60_000).toBe(0);
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
