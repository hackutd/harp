import { describe, expect, it } from "vitest";

import {
  formatPickerDate,
  getLocalParts,
  getLocalTimeZoneLabel,
  parseDateOnly,
  startOfDay,
  toDateKey,
} from "./datetime";

// These tests rely on the test process being pinned to America/Chicago
// (see vitest scripts in package.json) so local-time assertions are stable.

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

  it("uses a real abbreviation in the label and falls back otherwise", () => {
    // Summer date resolves to CDT (a real abbreviation).
    const summer = getLocalTimeZoneLabel(new Date("2026-07-04T18:00:00Z"));
    expect(summer.abbrev).toBe("CDT");
    expect(summer.label).toBe("CDT · America/Chicago");

    // A GMT-style fallback must not be paired with the IANA name.
    const winter = getLocalTimeZoneLabel(new Date("2026-01-15T18:00:00Z"));
    if (/^(GMT|UTC)[+-]/i.test(winter.abbrev)) {
      expect(winter.label).toBe("America/Chicago");
    } else {
      expect(winter.label).toBe(`${winter.abbrev} · America/Chicago`);
    }
  });
});
