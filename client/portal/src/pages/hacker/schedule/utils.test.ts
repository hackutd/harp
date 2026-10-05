import { describe, expect, it } from "vitest";

import type { ScheduleItem } from "@/types";

import {
  type DayEvent,
  enumerateDays,
  formatClock,
  formatHourLabel,
  formatMonthTitle,
  layoutDayEvents,
  toDayEvent,
} from "./utils";

// Tests run under TZ=America/Chicago (pinned in vitest.config.ts).

function item(id: string, startTime: string, endTime: string): ScheduleItem {
  return {
    id,
    event_name: `Event ${id}`,
    description: "",
    start_time: startTime,
    end_time: endTime,
    location: "",
    tags: [],
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
  };
}

/** Local-time helper: builds a UTC ISO instant for the given Chicago wall time. */
function chicagoInstant(dateKey: string, hour: number, minute: number): string {
  // Built from local Date parts rather than a hardcoded offset, so the CST
  // (UTC-6) → CDT (UTC-5) switch on Mar 8, 2026 is handled for us.
  const [y, m, d] = dateKey.split("-").map(Number);
  const local = new Date(y, m - 1, d, hour, minute);
  return local.toISOString();
}

describe("enumerateDays", () => {
  it.each([
    ["single day", "2026-03-14", "2026-03-14", ["2026-03-14"]],
    [
      "multi-day range inclusive",
      "2026-03-14",
      "2026-03-16",
      ["2026-03-14", "2026-03-15", "2026-03-16"],
    ],
  ])("covers %s inclusively", (_label, start, end, expectedKeys) => {
    expect(enumerateDays(start, end).map((day) => day.dateKey)).toEqual(
      expectedKeys,
    );
  });

  it.each([
    ["missing start", null, "2026-03-16"],
    ["missing end", "2026-03-14", null],
    ["malformed input", "gibberish", "2026-03-16"],
    ["reversed range", "2026-03-16", "2026-03-14"],
  ])("returns [] for %s", (_label, start, end) => {
    expect(enumerateDays(start, end)).toEqual([]);
  });
});

describe("toDayEvent", () => {
  it("converts instants to minutes-of-day in local time", () => {
    // 09:00–10:30 local on 2026-03-15
    const result = toDayEvent(
      item(
        "e1",
        chicagoInstant("2026-03-15", 9, 0),
        chicagoInstant("2026-03-15", 10, 30),
      ),
    );
    expect(result?.dateKey).toBe("2026-03-15");
    expect(result?.event.startMin).toBe(9 * 60);
    expect(result?.event.endMin).toBe(10 * 60 + 30);
  });

  it("clamps events running past midnight to the end of their start day", () => {
    // 23:00 → 00:30 next day
    const result = toDayEvent(
      item(
        "midnight",
        chicagoInstant("2026-03-15", 23, 0),
        chicagoInstant("2026-03-16", 0, 30),
      ),
    );
    expect(result?.dateKey).toBe("2026-03-15");
    expect(result?.event.startMin).toBe(23 * 60);
    expect(result?.event.endMin).toBe(24 * 60);
  });

  it("returns null for events that end on an earlier day than they start", () => {
    const result = toDayEvent(
      item(
        "reversed",
        chicagoInstant("2026-03-15", 9, 0),
        chicagoInstant("2026-03-14", 23, 0),
      ),
    );
    expect(result).toBeNull();
  });

  it("returns null for unparseable timestamps", () => {
    expect(toDayEvent(item("bad", "not-a-date", "also-bad"))).toBeNull();
  });

  it("gives zero/negative-length events a minimum 15-minute span", () => {
    const result = toDayEvent(
      item(
        "zero",
        chicagoInstant("2026-03-15", 12, 0),
        chicagoInstant("2026-03-15", 12, 0),
      ),
    );
    expect(result?.event.startMin).toBe(12 * 60);
    expect(result?.event.endMin).toBe(12 * 60 + 15);
  });
});

describe("layoutDayEvents", () => {
  function ev(id: string, startMin: number, endMin: number): DayEvent {
    return { item: item(id, "x", "y"), startMin, endMin };
  }

  it("assigns lane 0 and laneCount 1 when nothing overlaps", () => {
    const laid = layoutDayEvents([ev("a", 540, 600), ev("b", 660, 720)]);
    expect(laid).toHaveLength(2);
    for (const e of laid) {
      expect(e.lane).toBe(0);
      expect(e.laneCount).toBe(1);
    }
  });

  it("puts overlapping events side by side in distinct lanes", () => {
    const laid = layoutDayEvents([
      ev("a", 540, 660),
      ev("b", 600, 720),
      ev("c", 630, 690),
    ]);
    const byId = new Map(laid.map((e) => [e.item.id, e]));
    expect(byId.get("a")?.lane).toBe(0);
    expect(byId.get("b")?.lane).toBe(1);
    expect(byId.get("c")?.lane).toBe(2);
    expect(new Set(laid.map((e) => e.laneCount))).toEqual(new Set([3]));
  });

  it("reuses a lane freed earlier in the same overlap cluster", () => {
    // "long" spans the whole cluster; "late" starts after "early" ends, so it
    // takes lane 1 back instead of opening a third lane.
    const laid = layoutDayEvents([
      ev("long", 540, 720),
      ev("early", 560, 600),
      ev("late", 610, 650),
    ]);
    const byId = new Map(laid.map((e) => [e.item.id, e]));
    expect(byId.get("early")?.lane).toBe(1);
    expect(byId.get("late")?.lane).toBe(1);
    expect(byId.get("late")?.laneCount).toBe(2);
  });

  it("starts a new full-width cluster once every overlap has ended", () => {
    const laid = layoutDayEvents([
      ev("first", 540, 600),
      ev("overlap", 570, 660),
      ev("later", 660, 720),
    ]);
    const byId = new Map(laid.map((e) => [e.item.id, e]));
    expect(byId.get("overlap")?.laneCount).toBe(2);
    expect(byId.get("later")?.laneCount).toBe(1);
  });

  it("splits adjacent-but-not-overlapping events into separate clusters", () => {
    const laid = layoutDayEvents([ev("a", 540, 600), ev("b", 600, 660)]);
    expect(laid.map((e) => e.laneCount)).toEqual([1, 1]);
  });

  it("is deterministic regardless of input order (sorted by start)", () => {
    const events = [ev("a", 540, 660), ev("b", 600, 720)];
    const forward = layoutDayEvents(events);
    const backward = layoutDayEvents([...events].reverse());
    expect(backward.map((e) => [e.item.id, e.lane])).toEqual(
      forward.map((e) => [e.item.id, e.lane]),
    );
  });
});

describe("formatHourLabel / formatClock / formatMonthTitle", () => {
  it.each([
    [0, 12, "AM"],
    [9, 9, "AM"],
    [12, 12, "PM"],
    [13, 1, "PM"],
    [23, 11, "PM"],
  ])("formats hour %i as %i %s", (hour, value, suffix) => {
    expect(formatHourLabel(hour)).toEqual({ value, suffix });
  });

  it("formats clock labels with padded minutes", () => {
    expect(formatClock(9, 5)).toBe("9:05");
    expect(formatClock(12, 45)).toBe("12:45");
  });

  it("renders single-month and cross-month titles", () => {
    const march = enumerateDays("2026-03-01", "2026-03-31");
    expect(formatMonthTitle(march)).toBe("March");
    const febMar = [...enumerateDays("2026-02-28", "2026-02-28"), ...march];
    expect(formatMonthTitle(febMar)).toBe("Feb – Mar");
    expect(formatMonthTitle([])).toBe("");
  });
});
