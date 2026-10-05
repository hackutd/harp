import { describe, expect, it, vi } from "vitest";

import {
  formatElapsed,
  formatPickerDate,
  getLocalParts,
  getLocalTimeZoneLabel,
  parseDateOnly,
  startOfDay,
  toDateKey,
} from "./datetime";

// These tests rely on the test process being pinned to America/Chicago
// (see vitest.config.ts) so local-time assertions are stable.

describe("toDateKey", () => {
  it.each([
    ["pads month and day", new Date(2026, 2, 14), "2026-03-14"],
    ["handles year boundaries", new Date(2025, 11, 31), "2025-12-31"],
    ["handles single-digit days", new Date(2026, 0, 5), "2026-01-05"],
  ])("%s", (_name, date, expected) => {
    expect(toDateKey(date)).toBe(expected);
  });
});

describe("getLocalParts", () => {
  it("breaks an instant into local calendar parts", () => {
    // 18:00 UTC on 2026-03-14 == 13:00 CDT (DST began Mar 8, 2026)
    const parts = getLocalParts(new Date("2026-03-14T18:00:00Z"));
    expect(parts).toEqual({ dateKey: "2026-03-14", hour: 13, minute: 0 });
  });

  it("resolves to CST before DST", () => {
    const parts = getLocalParts(new Date("2026-01-15T18:00:00Z"));
    expect(parts).toEqual({ dateKey: "2026-01-15", hour: 12, minute: 0 });
  });
});

describe("parseDateOnly", () => {
  it.each([
    ["plain date-only value", "2026-03-14"],
    ["ISO string prefix", "2026-03-14T15:00:00Z"],
  ])("parses %s to local midnight", (_name, value) => {
    const parsed = parseDateOnly(value);
    expect(parsed).toEqual(new Date(2026, 2, 14));
  });

  it.each([
    ["empty string", ""],
    ["null", null],
    ["undefined", undefined],
    ["malformed value", "not-a-date"],
    ["missing day", "2026-03"],
  ])("returns null for %s", (_name, value) => {
    expect(parseDateOnly(value)).toBeNull();
  });
});

describe("startOfDay", () => {
  it("returns local midnight of the same calendar day", () => {
    const date = new Date(2026, 2, 14, 15, 42);
    expect(startOfDay(date)).toEqual(new Date(2026, 2, 14));
    expect(toDateKey(startOfDay(date))).toBe("2026-03-14");
  });
});

describe("formatPickerDate", () => {
  it("formats a date in en-US picker style", () => {
    expect(formatPickerDate(new Date(2026, 2, 14))).toBe("Sat, Mar 14, 2026");
  });

  it("returns the placeholder when unset", () => {
    expect(formatPickerDate(null)).toBe("Select date");
  });
});

describe("getLocalTimeZoneLabel", () => {
  it("reports the pinned test timezone as America/Chicago", () => {
    expect(getLocalTimeZoneLabel().iana).toBe("America/Chicago");
  });

  it.each([
    ["summer", "2026-07-04T18:00:00Z", "CDT"],
    ["winter", "2026-01-15T18:00:00Z", "CST"],
  ])(
    "pairs the DST-aware %s abbreviation with the IANA name",
    (_s, iso, abbrev) => {
      const zone = getLocalTimeZoneLabel(new Date(iso));
      expect(zone.abbrev).toBe(abbrev);
      expect(zone.label).toBe(`${abbrev} · America/Chicago`);
    },
  );

  it("falls back to the IANA name alone for a GMT-offset abbreviation", () => {
    const spy = vi
      .spyOn(Intl.DateTimeFormat.prototype, "formatToParts")
      .mockReturnValue([{ type: "timeZoneName", value: "GMT-6" }]);
    try {
      const zone = getLocalTimeZoneLabel(new Date("2026-01-15T18:00:00Z"));
      expect(zone.abbrev).toBe("GMT-6");
      expect(zone.label).toBe("America/Chicago");
    } finally {
      spy.mockRestore();
    }
  });
});

describe("formatElapsed", () => {
  const start = new Date("2026-03-14T12:00:00Z");
  const after = (seconds: number) => new Date(start.getTime() + seconds * 1000);

  it.each([
    ["seconds only", 42, "42s"],
    ["minutes and seconds", 9 * 60 + 2, "9m 2s"],
    ["whole minutes", 5 * 60, "5m"],
    ["hours and minutes, dropping seconds", 3 * 3600 + 15 * 60 + 9, "3h 15m"],
    ["whole hours", 2 * 3600, "2h"],
    ["days and hours", 2 * 86400 + 4 * 3600 + 59, "2d 4h"],
    ["whole days", 86400, "1d"],
    ["zero", 0, "0s"],
  ])("formats %s", (_label, seconds, expected) => {
    expect(formatElapsed(start, after(seconds))).toBe(expected);
  });

  it("reads an end before the start as 0s", () => {
    expect(formatElapsed(start, after(-30))).toBe("0s");
  });
});
