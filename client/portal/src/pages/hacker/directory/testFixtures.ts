import type { DirectoryCardData } from "./types";

/** Full card fixture for tests, with per-test overrides. */
export function directoryCard(
  overrides: Partial<DirectoryCardData> = {},
): DirectoryCardData {
  return {
    user_id: "u-2",
    display_name: "Bob Builder",
    pronouns: null,
    headshot_url: null,
    skills: [],
    interest_tags: [],
    roles_looking_for: [],
    icebreaker_prompt: null,
    icebreaker_answer: null,
    want_to_build: null,
    github_username: null,
    linkedin_handle: null,
    experiences: [],
    intent: "looking_for_teammates",
    spots_needed: null,
    status_confirmed_at: "2026-11-01T12:00:00Z",
    checked_in: false,
    stale: false,
    poked_by_me: false,
    poked_me: false,
    matched: false,
    is_contact: false,
    is_hidden: false,
    discord_username: null,
    ...overrides,
  };
}
