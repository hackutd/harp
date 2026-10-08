import { describe, expect, it } from "vitest";

import { directoryQuery } from "./api";
import { EMPTY_FILTERS } from "./store";
import { directoryCard } from "./testFixtures";
import {
  groupPokes,
  initials,
  intentLabel,
  pokedYouSummary,
  roleLabel,
} from "./utils";

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

describe("directoryQuery", () => {
  it("is empty with no filters", () => {
    expect(directoryQuery(EMPTY_FILTERS)).toBe("");
  });

  it("encodes every filter and the cursor", () => {
    const qs = directoryQuery(
      {
        intents: ["partial_team", "team_set"],
        tags: ["AI/ML", "Web Dev"],
        q: "  rust ",
        checkedIn: true,
        hidden: true,
      },
      "abc",
    );
    const params = new URLSearchParams(qs.slice(1));
    expect(params.get("intent")).toBe("partial_team,team_set");
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

describe("pokedYouSummary", () => {
  const poker = (display_name: string) => ({
    user_id: display_name,
    display_name,
    headshot_url: null,
  });
  const ada = poker("Ada Lovelace");
  const grace = poker("Grace Hopper");
  const alan = poker("Alan Turing");

  it.each([
    [1, [ada], "Ada poked you"],
    [2, [ada, grace], "Ada and Grace poked you"],
    [3, [ada, grace, alan], "Ada, Grace and 1 other poked you"],
    [7, [ada, grace, alan], "Ada, Grace and 5 others poked you"],
  ])("%i pokes", (count, pokers, out) => {
    expect(pokedYouSummary({ count, pokers })).toBe(out);
  });
});

describe("groupPokes", () => {
  const waiting = directoryCard({ user_id: "w", poked_me: true });
  const matched = directoryCard({
    user_id: "m",
    poked_me: true,
    poked_by_me: true,
    matched: true,
  });
  const sent = directoryCard({ user_id: "s", poked_by_me: true });

  it("splits received and sent pokes into the three sections", () => {
    const groups = groupPokes([waiting, matched], [{ ...matched }, sent]);
    expect(groups.waiting).toEqual([waiting]);
    expect(groups.matched).toEqual([matched]);
    expect(groups.sent).toEqual([sent]);
  });

  it("leaves every section empty with no pokes", () => {
    expect(groupPokes([], [])).toEqual({ waiting: [], matched: [], sent: [] });
  });
});
