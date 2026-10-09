import { describe, expect, it } from "vitest";

import {
  browserTimeZoneLabel,
  fromDeadlineInputValue,
  toDeadlineInputValue,
  toOffsetISOString,
} from "./priorityDeadline";

// Tests run under TZ=America/Chicago (pinned in vitest.config.ts).
describe("fromDeadlineInputValue", () => {
  it("takes the last millisecond of the picked minute, in the local offset", () => {
    expect(fromDeadlineInputValue("2026-10-03T23:59")).toBe(
      "2026-10-03T23:59:59.999-05:00",
    );
  });

  it("uses standard time once daylight saving ends", () => {
    expect(fromDeadlineInputValue("2026-12-01T12:00")).toBe(
      "2026-12-01T12:00:59.999-06:00",
    );
  });

  it("returns null for an empty or invalid value", () => {
    expect(fromDeadlineInputValue("")).toBeNull();
    expect(fromDeadlineInputValue("not a date")).toBeNull();
  });
});

describe("toDeadlineInputValue", () => {
  it("shows a stored deadline as local wall time", () => {
    expect(toDeadlineInputValue("2026-10-04T04:59:59.999Z")).toBe(
      "2026-10-03T23:59",
    );
  });

  it("round-trips through fromDeadlineInputValue", () => {
    const stored = fromDeadlineInputValue("2026-10-03T23:59")!;
    expect(toDeadlineInputValue(stored)).toBe("2026-10-03T23:59");
  });

  it("is empty when no deadline is set", () => {
    expect(toDeadlineInputValue(null)).toBe("");
  });
});

describe("toOffsetISOString", () => {
  it("formats the same instant as toISOString, in the local offset", () => {
    const d = new Date("2026-10-04T04:59:59.999Z");
    const formatted = toOffsetISOString(d);
    expect(formatted).toBe("2026-10-03T23:59:59.999-05:00");
    expect(new Date(formatted).getTime()).toBe(d.getTime());
  });
});

describe("browserTimeZoneLabel", () => {
  it("names the zone and its abbreviation at the given date", () => {
    expect(browserTimeZoneLabel(new Date("2026-10-03T12:00:00Z"))).toBe(
      "America/Chicago (CDT)",
    );
  });
});
