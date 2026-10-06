import { describe, expect, it } from "vitest";

import type { AttendanceView } from "./types";
import {
  ATTENDANCE_VIEW_FILTERS,
  attendanceViewOf,
  formatCheckIn,
  isAttendanceView,
} from "./utils";

const VIEWS = Object.keys(ATTENDANCE_VIEW_FILTERS) as AttendanceView[];

describe("attendance views", () => {
  it.each(VIEWS)("round-trips %s through its filters", (view) => {
    const f = ATTENDANCE_VIEW_FILTERS[view];
    expect(attendanceViewOf(f.status, f.rsvp_status, f.checked_in)).toBe(view);
  });

  it("pins status=accepted on every RSVP-based view", () => {
    for (const view of VIEWS) {
      const f = ATTENDANCE_VIEW_FILTERS[view];
      if (f.rsvp_status !== null) expect(f.status).toBe("accepted");
    }
  });

  it.each([
    ["no filters", null, null, null, null],
    ["checked in under a status tab", "accepted", null, true, "checked_in"],
    ["checked in under all", null, null, true, "checked_in"],
    ["rsvp outside accepted", "rejected", "pending", null, null],
    ["rsvp with no status", null, "confirmed", null, null],
    ["not checked in alone", null, null, false, null],
    ["declined + not checked in", "accepted", "declined", false, null],
    ["pending + checked in", "accepted", "pending", true, null],
  ] as const)("maps %s to %s", (_name, status, rsvp, checkedIn, want) => {
    expect(attendanceViewOf(status, rsvp, checkedIn)).toBe(want);
  });

  it.each([
    ["no_show", true],
    ["checked_in", true],
    ["accepted", false],
    ["toString", false],
    [null, false],
  ])("isAttendanceView(%s) is %s", (value, want) => {
    expect(isAttendanceView(value)).toBe(want);
  });
});

describe("formatCheckIn", () => {
  it("shows weekday and local time", () => {
    // 2026-11-14 is a Saturday; vitest pins TZ to America/Chicago (UTC-6).
    expect(formatCheckIn("2026-11-14T15:41:00Z")).toBe("Sat 9:41 AM");
  });
});
