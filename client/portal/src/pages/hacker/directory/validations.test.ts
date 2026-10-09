import { describe, expect, it } from "vitest";

import type { DirectoryProfile } from "./types";
import {
  directoryProfileSchema,
  formToPayload,
  profileToForm,
} from "./validations";

const base = () => ({
  ...profileToForm(null, "Ada"),
  interest_tags: ["AI/ML"],
});

function issuesFor(value: unknown) {
  const res = directoryProfileSchema.safeParse(value);
  return res.success ? [] : res.error.issues.map((i) => i.path.join("."));
}

describe("directoryProfileSchema", () => {
  it("accepts a minimal card", () => {
    expect(issuesFor(base())).toEqual([]);
  });

  it("requires a display name", () => {
    expect(issuesFor({ ...base(), display_name: "   " })).toEqual([
      "display_name",
    ]);
  });

  it("needs spots for a partial team", () => {
    expect(issuesFor({ ...base(), intent: "partial_team" })).toEqual([
      "spots_needed",
    ]);
    expect(
      issuesFor({ ...base(), intent: "partial_team", spots_needed: 2 }),
    ).toEqual([]);
  });

  it("caps interest tags at 5", () => {
    const tags = ["a", "b", "c", "d", "e"];
    expect(issuesFor({ ...base(), interest_tags: tags })).toEqual([]);
    expect(issuesFor({ ...base(), interest_tags: [...tags, "f"] })).toEqual([
      "interest_tags",
    ]);
  });

  it("caps the icebreaker at 200 characters", () => {
    const prompt = "Ask me about...";
    expect(
      issuesFor({
        ...base(),
        icebreaker_prompt: prompt,
        icebreaker_answer: "x".repeat(200),
      }),
    ).toEqual([]);
    expect(
      issuesFor({
        ...base(),
        icebreaker_prompt: prompt,
        icebreaker_answer: "x".repeat(201),
      }),
    ).toEqual(["icebreaker_answer"]);
  });

  it("needs a prompt for an answer", () => {
    expect(issuesFor({ ...base(), icebreaker_answer: "hi" })).toEqual([
      "icebreaker_prompt",
    ]);
  });
});

describe("formToPayload", () => {
  it("trims, drops empty skills, and nulls blank text", () => {
    const payload = formToPayload({
      ...base(),
      display_name: "  Ada  ",
      skills: [" Go ", "", "Rust"],
      pronouns: "  ",
      icebreaker_prompt: "Ask me about...",
      icebreaker_answer: "  ",
      spots_needed: 3,
    });
    expect(payload).toMatchObject({
      display_name: "Ada",
      skills: ["Go", "Rust"],
      pronouns: null,
      icebreaker_prompt: null,
      icebreaker_answer: null,
      want_to_build: null,
      spots_needed: null,
    });
  });

  it("keeps spots for a partial team", () => {
    const payload = formToPayload({
      ...base(),
      intent: "partial_team",
      spots_needed: 2,
    });
    expect(payload.spots_needed).toBe(2);
  });
});

describe("links and experience", () => {
  it("needs both a company and a role for each experience", () => {
    expect(
      issuesFor({
        ...base(),
        experiences: [
          { company: "Acme", title: "" },
          { company: "", title: "Intern" },
          { company: "", title: "" },
        ],
      }),
    ).toEqual(["experiences.0.title", "experiences.1.company"]);
  });

  it("trims links, drops blank experience rows, and nulls empty links", () => {
    const payload = formToPayload({
      ...base(),
      github_username: "  octocat ",
      linkedin_handle: " ",
      experiences: [
        { company: " Acme ", title: " SWE Intern " },
        { company: "", title: "" },
      ],
    });
    expect(payload).toMatchObject({
      github_username: "octocat",
      linkedin_handle: null,
      experiences: [{ company: "Acme", title: "SWE Intern" }],
    });
  });

  it("only sends visibility when asked to", () => {
    expect(formToPayload(base())).not.toHaveProperty("discoverable");
    expect(formToPayload(base(), false).discoverable).toBe(false);
  });
});

describe("profileToForm", () => {
  it("keeps only the interests the hacker typed in", () => {
    const form = profileToForm({
      display_name: "Ada",
      skills: ["Go"],
    } as DirectoryProfile);
    expect(form.skills).toEqual(["Go"]);
  });

  it("falls back to the default for a status no longer offered", () => {
    const form = profileToForm({
      display_name: "Ada",
      intent: "open_to_collab",
    } as unknown as DirectoryProfile);
    expect(form.intent).toBe("looking_for_teammates");
  });
});
