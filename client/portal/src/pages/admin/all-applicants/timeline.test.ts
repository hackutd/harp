import { describe, expect, it } from "vitest";

import {
  addDays,
  buildTimelineSeries,
  formatDayKey,
  sumSeries,
  todayKey,
} from "./timeline";
import type { ApplicationTimelinePoint } from "./types";

function point(
  date: string,
  started: number,
  submitted: number,
): ApplicationTimelinePoint {
  return { date, started, submitted };
}

describe("addDays", () => {
  it.each([
    ["next day", "2026-09-01", 1, "2026-09-02"],
    ["month rollover", "2026-08-31", 1, "2026-09-01"],
    ["year rollover", "2026-12-31", 1, "2027-01-01"],
    ["backwards", "2026-03-01", -1, "2026-02-28"],
    ["across the DST switch", "2026-03-07", 2, "2026-03-09"],
  ])("handles %s", (_label, key, days, expected) => {
    expect(addDays(key, days)).toBe(expected);
  });
});

describe("todayKey", () => {
  it.each([
    ["UTC", "UTC", "2026-09-02"],
    ["a zone behind UTC rolls back a day", "America/Chicago", "2026-09-01"],
    ["a zone ahead of UTC", "Asia/Tokyo", "2026-09-02"],
  ])("formats %s", (_label, tz, expected) => {
    expect(todayKey(tz, new Date("2026-09-02T03:00:00Z"))).toBe(expected);
  });
});

describe("formatDayKey", () => {
  it("formats the key without shifting it by the host zone", () => {
    // Tests run in America/Chicago, where midnight UTC is the previous day.
    expect(formatDayKey("2026-09-01")).toBe("Sep 1");
  });
});

describe("buildTimelineSeries", () => {
  const points = [
    point("2026-08-20", 5, 1),
    point("2026-08-30", 2, 2),
    point("2026-09-01", 4, 3),
  ];

  it("returns nothing when there is no data", () => {
    expect(
      buildTimelineSeries([], {
        range: "all",
        cumulative: false,
        today: "2026-09-02",
      }),
    ).toEqual([]);
  });

  it("fills idle days with zeros through today", () => {
    const series = buildTimelineSeries(points, {
      range: "7d",
      cumulative: false,
      today: "2026-09-02",
    });
    expect(series).toEqual([
      point("2026-08-27", 0, 0),
      point("2026-08-28", 0, 0),
      point("2026-08-29", 0, 0),
      point("2026-08-30", 2, 2),
      point("2026-08-31", 0, 0),
      point("2026-09-01", 4, 3),
      point("2026-09-02", 0, 0),
    ]);
  });

  it("starts the all-time range at the first application", () => {
    const series = buildTimelineSeries(points, {
      range: "all",
      cumulative: false,
      today: "2026-09-02",
    });
    expect(series[0]).toEqual(point("2026-08-20", 5, 1));
    expect(series).toHaveLength(14);
    expect(sumSeries(series)).toEqual({ started: 11, submitted: 6 });
  });

  it("carries totals from before the window into cumulative mode", () => {
    const series = buildTimelineSeries(points, {
      range: "7d",
      cumulative: true,
      today: "2026-09-02",
    });
    expect(series[0]).toEqual(point("2026-08-27", 5, 1));
    expect(series.at(-1)).toEqual(point("2026-09-02", 11, 6));
  });

  it("pads before the first application when the window reaches back further", () => {
    const series = buildTimelineSeries([point("2026-09-01", 4, 3)], {
      range: "7d",
      cumulative: true,
      today: "2026-09-02",
    });
    expect(series).toHaveLength(7);
    expect(series[0]).toEqual(point("2026-08-27", 0, 0));
    expect(series.at(-1)).toEqual(point("2026-09-02", 4, 3));
  });

  it("extends past today when the server's last day is ahead of the client", () => {
    const series = buildTimelineSeries([point("2026-09-03", 1, 0)], {
      range: "7d",
      cumulative: false,
      today: "2026-09-02",
    });
    expect(series.at(-1)).toEqual(point("2026-09-03", 1, 0));
  });
});
