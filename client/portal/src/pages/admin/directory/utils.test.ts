import { describe, expect, it } from "vitest";

import { directoryAdminQuery } from "./api";
import { adminProfile } from "./testFixtures";
import { cardStatus } from "./utils";

describe("cardStatus", () => {
  it.each([
    ["a visible card", {}, "visible"],
    ["a card its owner hid", { discoverable: false }, "hidden_by_owner"],
    [
      "a moderated card",
      { moderation_hidden_at: "2026-10-02T00:00:00Z" },
      "moderated",
    ],
    [
      "a moderated card its owner also hid",
      { discoverable: false, moderation_hidden_at: "2026-10-02T00:00:00Z" },
      "moderated",
    ],
  ] as const)("labels %s", (_label, overrides, expected) => {
    expect(cardStatus(adminProfile(overrides))).toBe(expected);
  });
});

describe("directoryAdminQuery", () => {
  it("is empty with no search or cursor", () => {
    expect(directoryAdminQuery("   ")).toBe("");
  });

  it("encodes a trimmed search and the cursor", () => {
    expect(directoryAdminQuery(" bob@ex ", "abc=")).toBe(
      "?search=bob%40ex&cursor=abc%3D",
    );
  });
});
