import { describe, expect, it } from "vitest";

import { directoryQuery } from "./api";
import { EMPTY_FILTERS } from "./store";
import { directoryCard } from "./testFixtures";
import { discordLink, initials, intentLabel, roleLabel } from "./utils";

describe("intentLabel", () => {
  it.each([
    ["partial_team", 2, "Team needs 2 more"],
    ["partial_team", null, "Team has spots"],
    ["team_set", null, "Team set"],
    ["just_networking", 3, "Just networking"],
  ] as const)("%s with %s spots", (intent, spots, label) => {
    expect(intentLabel(intent, spots)).toBe(label);
  });
});

describe("initials", () => {
  it.each([
    ["Ada Lovelace", "AL"],
    ["  cher  ", "C"],
    ["Mary Ann Evans", "MA"],
    ["", "?"],
  ])("%j -> %s", (name, out) => {
    expect(initials(name)).toBe(out);
  });
});

describe("discordLink", () => {
  it("deep links when the Discord ID is known", () => {
    expect(discordLink(directoryCard({ discord_user_id: "42" }))).toBe(
      "https://discord.com/users/42",
    );
  });

  it("returns null with only a username", () => {
    expect(discordLink(directoryCard({ discord_username: "bob" }))).toBeNull();
  });
});

describe("directoryQuery", () => {
  it("is empty with no filters", () => {
    expect(directoryQuery(EMPTY_FILTERS)).toBe("");
  });

  it("encodes every filter and the cursor", () => {
    const qs = directoryQuery(
      {
        intents: ["partial_team", "open_to_collab"],
        tags: ["AI/ML", "Web Dev"],
        q: "  rust ",
        checkedIn: true,
        hidden: true,
      },
      "abc",
    );
    const params = new URLSearchParams(qs.slice(1));
    expect(params.get("intent")).toBe("partial_team,open_to_collab");
    expect(params.get("tags")).toBe("AI/ML,Web Dev");
    expect(params.get("q")).toBe("rust");
    expect(params.get("checked_in")).toBe("true");
    expect(params.get("hidden")).toBe("true");
    expect(params.get("cursor")).toBe("abc");
  });
});

describe("roleLabel", () => {
  it("labels known roles and passes unknown ones through", () => {
    expect(roleLabel("ml_ai")).toBe("ML / AI");
    expect(roleLabel("fullstack")).toBe("Full stack");
    expect(roleLabel("dj")).toBe("dj");
  });
});
