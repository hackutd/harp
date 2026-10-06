import { describe, expect, it } from "vitest";

import type { ApplicationListItem } from "@/pages/admin/all-applicants/types";
import type { Application } from "@/types";

import { buildResponsesPatch, syncListItem } from "./utils";

describe("buildResponsesPatch", () => {
  it("is empty when nothing changed", () => {
    const answers = { first_name: "Ada", age: 20, langs: ["Go"], ok: true };
    expect(buildResponsesPatch(answers, { ...answers })).toEqual({});
  });

  it.each([
    ["changed text", { a: "x" }, { a: "y" }, { a: "y" }],
    ["changed number", { a: 1 }, { a: 2 }, { a: 2 }],
    ["unchecked box", { a: true }, { a: false }, { a: false }],
    ["new answer", {}, { a: "x" }, { a: "x" }],
    [
      "reordered choices",
      { a: ["x", "y"] },
      { a: ["y", "x"] },
      { a: ["y", "x"] },
    ],
    ["cleared text", { a: "x" }, { a: "" }, { a: null }],
    ["whitespace-only text", { a: "x" }, { a: "   " }, { a: null }],
    ["emptied choices", { a: ["x"] }, { a: [] }, { a: null }],
    ["cleared number", { a: 3 }, { a: null }, { a: null }],
    ["NaN number", { a: 3 }, { a: Number.NaN }, { a: null }],
  ])("reports a %s", (_label, original, edited, expected) => {
    expect(buildResponsesPatch(original, edited)).toEqual(expected);
  });

  it.each([
    ["absent vs empty string", {}, { a: "" }],
    ["null vs empty array", { a: null }, { a: [] }],
    ["empty string vs undefined", { a: "" }, { a: undefined }],
  ])("treats %s as unchanged", (_label, original, edited) => {
    expect(buildResponsesPatch(original, edited)).toEqual({});
  });

  it("leaves untouched answers out of the patch", () => {
    expect(
      buildResponsesPatch(
        { first_name: "Ada", last_name: "L" },
        { first_name: "Grace", last_name: "L" },
      ),
    ).toEqual({ first_name: "Grace" });
  });
});

function listItem(overrides: Partial<ApplicationListItem> = {}) {
  return {
    id: "1",
    user_id: "u1",
    email: "ada@example.com",
    status: "submitted",
    first_name: "Ada",
    last_name: "L",
    phone: null,
    age: 20,
    country_of_residence: "US",
    gender: null,
    university: "UTD",
    major: "CS",
    level_of_study: null,
    hackathons_attended: 0,
    submitted_at: "2026-03-14T15:00:00Z",
    created_at: "2026-03-14T15:00:00Z",
    updated_at: "2026-03-14T15:00:00Z",
    ai_percent: null,
    accept_votes: 2,
    reject_votes: 0,
    waitlist_votes: 0,
    reviews_assigned: 2,
    reviews_completed: 2,
    has_resume: false,
    points: 0,
    travel_status: "not_requested",
    travel_yes_votes: 0,
    travel_no_votes: 0,
    travel_approved_amount_cents: null,
    rsvp_status: "pending",
    travel_rsvp_status: "pending",
    rsvp_submitted_at: null,
    travel_rsvp_submitted_at: null,
    receipt_count: 0,
    estimated_travel_cost_cents: null,
    checked_in_at: null,
    ...overrides,
  } satisfies ApplicationListItem;
}

function application(overrides: Partial<Application> = {}): Application {
  return {
    id: "1",
    user_id: "u1",
    status: "draft",
    responses: {},
    meal_group: null,
    resume_path: null,
    ai_percent: null,
    accept_votes: 2,
    reject_votes: 0,
    waitlist_votes: 0,
    reviews_assigned: 2,
    reviews_completed: 2,
    submitted_at: "2026-03-14T15:00:00Z",
    created_at: "2026-03-14T15:00:00Z",
    updated_at: "2026-03-15T15:00:00Z",
    rsvp_status: "pending",
    rsvp_responses: {},
    rsvp_submitted_at: null,
    travel_status: "not_requested",
    travel_yes_votes: 0,
    travel_no_votes: 0,
    travel_approved_amount_cents: null,
    travel_rsvp_status: "pending",
    travel_rsvp_responses: {},
    travel_rsvp_submitted_at: null,
    travel_receipt_paths: [],
    ...overrides,
  };
}

describe("syncListItem", () => {
  it("copies the edited answers, status, and resume onto the row", () => {
    const synced = syncListItem(
      listItem(),
      application({
        status: "draft",
        resume_path: "hackathons/x/resumes/u1/a.pdf",
        responses: { first_name: "Grace", age: 21, university: "" },
      }),
    );

    expect(synced).toMatchObject({
      status: "draft",
      has_resume: true,
      first_name: "Grace",
      last_name: null,
      age: 21,
      university: null,
    });
  });

  it("keeps the row's review and travel fields", () => {
    const synced = syncListItem(listItem(), application());
    expect(synced.accept_votes).toBe(2);
    expect(synced.email).toBe("ada@example.com");
    expect(synced.has_resume).toBe(false);
  });
});
