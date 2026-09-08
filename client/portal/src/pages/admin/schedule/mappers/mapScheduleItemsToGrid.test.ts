import { describe, expect, it } from "vitest";

import type { ScheduleResponseItem } from "../api";
import { mapScheduleItemsToGrid } from "./mapScheduleItemsToGrid";

// Tests run under TZ=America/Chicago (pinned in package.json).
// March 2026 dates are after DST starts (Mar 8), so Chicago = CDT = UTC-5.

function item(
  overrides: Partial<ScheduleResponseItem> = {},
): ScheduleResponseItem {
  return {
    id: "evt-1",
    event_name: "Check-in",
    description: "Get your badge",
    start_time: "2026-03-14T15:00:00Z", // 10:00 AM CDT
    end_time: "2026-03-14T17:00:00Z", // 12:00 PM CDT
    location: "Lobby",
    tags: [],
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
    ...overrides,
  };
}

const scheduleDays = [
  new Date(2026, 2, 13),
  new Date(2026, 2, 14),
  new Date(2026, 2, 15),
];

describe("mapScheduleItemsToGrid", () => {
  it("maps an instant to its local day column and quarter slots", () => {
    // 2026-03-14T15:00:00Z → 10:00 AM CDT (UTC-5) → quarter 40..48
    // (noon end lands exactly on the quarter-48 boundary)
    const result = mapScheduleItemsToGrid([item()], scheduleDays);
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      id: "evt-1",
      dayIndex: 1,
      startQuarter: 40,
      endQuarter: 48,
      title: "Check-in",
      location: "Lobby",
      details: "Get your badge",
      tags: [],
    });
  });

  it("rounds end times up to the next quarter and guarantees min length", () => {
    // 10:00–10:10 local → quarters 40..41
    const result = mapScheduleItemsToGrid(
      [
        item({
          id: "short",
          start_time: "2026-03-14T15:00:00Z",
          end_time: "2026-03-14T15:10:00Z",
        }),
      ],
      scheduleDays,
    );
    expect(result[0].startQuarter).toBe(40);
    expect(result[0].endQuarter).toBe(41);
  });

  it("keeps overlapping events on the same day as separate grid items", () => {
    const result = mapScheduleItemsToGrid(
      [
        item({
          id: "a",
          start_time: "2026-03-14T16:00:00Z",
          end_time: "2026-03-14T18:00:00Z",
        }),
        item({
          id: "b",
          start_time: "2026-03-14T17:00:00Z",
          end_time: "2026-03-14T19:00:00Z",
        }),
      ],
      scheduleDays,
    );
    expect(result.map((r) => r.id)).toEqual(["a", "b"]);
    expect(new Set(result.map((r) => r.dayIndex))).toEqual(new Set([1]));
  });

  it.each([
    ["midnight-spanning", "2026-03-15T04:00:00Z", "2026-03-15T05:30:00Z"],
    ["invalid start timestamp", "not-a-date", "2026-03-14T21:00:00Z"],
    ["invalid end timestamp", "2026-03-14T21:00:00Z", ""],
  ])("drops %s events per product rules", (_label, start, end) => {
    expect(
      mapScheduleItemsToGrid(
        [item({ id: "x", start_time: start, end_time: end })],
        scheduleDays,
      ),
    ).toEqual([]);
  });

  it("drops events whose local day is not in the configured schedule days", () => {
    const result = mapScheduleItemsToGrid(
      [item({ id: "outside" })],
      [new Date(2026, 2, 13)],
    );
    expect(result).toEqual([]);
  });

  it("clamps events starting at the last slot defensively", () => {
    // 23:45–23:55 local on Mar 14 → quarter 95; end stays within the day.
    const result = mapScheduleItemsToGrid(
      [
        item({
          id: "late",
          start_time: "2026-03-15T04:45:00Z",
          end_time: "2026-03-15T04:55:00Z",
        }),
      ],
      [new Date(2026, 2, 14)],
    );
    expect(result[0]?.startQuarter).toBe(95);
    expect(result[0]?.endQuarter).toBe(96);
  });

  it("preserves tags when provided", () => {
    const result = mapScheduleItemsToGrid(
      [item({ id: "t", tags: ["Food"] })],
      scheduleDays,
    );
    expect(result[0].tags).toEqual(["Food"]);
  });
});
