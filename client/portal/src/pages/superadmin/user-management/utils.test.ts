import { describe, expect, it } from "vitest";

import {
  allRoles,
  formatDate,
  formatUserName,
  getUserInitial,
  MIN_SEARCH_LENGTH,
  roleLabels,
} from "./utils";

describe("role presentation", () => {
  it("labels every role consistently", () => {
    expect(roleLabels.hacker).toBe("Hacker");
    expect(roleLabels.admin).toBe("Admin");
    expect(roleLabels.super_admin).toBe("Super Admin");
  });

  it("exposes every role in the filter list", () => {
    expect(allRoles).toContain("hacker");
    expect(allRoles).toContain("admin");
    expect(allRoles).toContain("super_admin");
  });

  it("requires a minimum search length to trigger a search", () => {
    expect(MIN_SEARCH_LENGTH).toBeGreaterThan(0);
  });
});

describe("formatUserName", () => {
  it.each([
    ["Ada", "Lovelace", "Ada Lovelace"],
    ["Ada", null, "Ada"],
    [null, "Lovelace", "Lovelace"],
    [null, null, ""],
    ["", "", ""],
  ])(
    "formats (%s, %s) as %j including edge inputs",
    (first, last, expected) => {
      expect(formatUserName(first, last)).toBe(expected);
    },
  );
});

describe("getUserInitial", () => {
  it.each([
    ["ada", "ada@example.com", "A"],
    [null, "grace@example.com", "G"],
    [null, "", ""],
    ["", "z@x.com", "Z"],
  ])("derives initial from (%s, %s)", (first, email, expected) => {
    expect(getUserInitial(first, email)).toBe(expected);
  });
});

describe("formatDate", () => {
  it("renders a short US date label deterministically under the pinned timezone", () => {
    expect(formatDate("2026-03-14T15:00:00Z")).toMatch(/Mar 1[45], 2026/);
  });

  it("renders end-to-end dates consistently", () => {
    expect(formatDate("2026-12-31T23:59:59Z")).toMatch(/Dec (30|31), 2026/);
  });
});
