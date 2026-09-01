import { describe, expect, it } from "vitest";

import { QUARTER_HOUR_SLOTS } from "./constants";
import {
  buildSelectionBounds,
  dateForQuarter,
  formatDayHeader,
  formatQuarterTime,
  getDateRange,
} from "./utils";

// Tests run under TZ=America/Chicago (pinned in package.json), so local-time
// expectations below are deterministic on any host machine.

describe("getDateRange", () => {
  it.each([
    ["single day", "2026-03-14", "2026-03-14", 1],
    ["two days", "2026-03-14", "2026-03-15", 2],
    ["full week inclusive", "2026-03-14", "2026-03-20", 7],
    ["month boundary", "2026-02-28", "2026-03-02", 3],
  ])("expands %s inclusively (%i days)", (_label, start, end, expected) => {
    const days = getDateRange(
      new Date(`${start}T00:00:00`),
      new Date(`${end}T00:00:00`),
    );
    expect(days).toHaveLength(expected);
    expect(days[0]).toEqual(new Date(`${start}T00:00:00`));
    expect(days[days.length - 1]).toEqual(new Date(`${end}T00:00:00`));
  });

  it("returns every configured day without gaps", () => {
    const days = getDateRange(new Date(2026, 2, 14), new Date(2026, 2, 16));
    const keys = days.map((d) => d.getDate());
    expect(keys).toEqual([14, 15, 16]);
  });

  it("returns an empty range when start is after end", () => {
    const days = getDateRange(new Date(2026, 2, 16), new Date(2026, 2, 14));
    expect(days).toEqual([]);
  });
});

describe("formatDayHeader", () => {
  it("renders a weekday/month/day label at local time", () => {
    // March 14 2026 is a Saturday.
    expect(formatDayHeader(new Date(2026, 2, 14))).toBe("Sat, Mar 14");
  });
});

describe("formatQuarterTime", () => {
  it.each([
    [0, "12:00 AM"],
    [1, "12:15 AM"],
    [2, "12:30 AM"],
    [3, "12:45 AM"],
    [4, "1:00 AM"],
    [19, "4:45 AM"],
    [20, "5:00 AM"],
    [44, "11:00 AM"],
    [47, "11:45 AM"],
    [48, "12:00 PM"],
    [49, "12:15 PM"],
    [72, "6:00 PM"],
    [95, "11:45 PM"],
  ])(
    "quarter %i renders as %s at the intended local time",
    (quarter, expected) => {
      expect(formatQuarterTime(quarter)).toBe(expected);
    },
  );

  it("clamps out-of-range quarters defensively", () => {
    expect(formatQuarterTime(-5)).toBe("12:00 AM");
    // Clamps to the final slot of the day (96 → 24:00 renders as 12:00 PM).
    expect(formatQuarterTime(QUARTER_HOUR_SLOTS)).toBe("12:00 PM");
  });
});

describe("buildSelectionBounds", () => {
  it.each([
    ["top-down drag", 8, 11, { startQuarter: 8, endQuarter: 12 }],
    ["bottom-up drag", 11, 8, { startQuarter: 8, endQuarter: 12 }],
    ["same-quarter click", 20, 20, { startQuarter: 20, endQuarter: 21 }],
  ])(
    "%s yields the same inclusive range",
    (_label, start, current, expected) => {
      expect(
        buildSelectionBounds({
          dayIndex: 0,
          startQuarter: start,
          currentQuarter: current,
        }),
      ).toEqual(expected);
    },
  );

  it("is direction-independent for multi-slot drags", () => {
    const forward = buildSelectionBounds({
      dayIndex: 0,
      startQuarter: 4,
      currentQuarter: 9,
    });
    const backward = buildSelectionBounds({
      dayIndex: 0,
      startQuarter: 9,
      currentQuarter: 4,
    });
    expect(forward).toEqual(backward);
  });
});

describe("dateForQuarter", () => {
  it("builds a local-time Date from a day column and quarter slot", () => {
    const day = new Date(2026, 2, 14);
    expect(dateForQuarter(day, 40)).toEqual(new Date(2026, 2, 14, 10, 0, 0, 0));
    expect(dateForQuarter(day, 41)).toEqual(
      new Date(2026, 2, 14, 10, 15, 0, 0),
    );
    expect(dateForQuarter(day, 0)).toEqual(new Date(2026, 2, 14, 0, 0, 0, 0));
    expect(dateForQuarter(day, 95)).toEqual(
      new Date(2026, 2, 14, 23, 45, 0, 0),
    );
  });

  it("keeps midnight boundaries on the same calendar day", () => {
    const day = new Date(2026, 2, 14);
    const built = dateForQuarter(day, 96 - 1);
    expect(built.getDate()).toBe(14);
    expect(built.getHours()).toBe(23);
  });
});
