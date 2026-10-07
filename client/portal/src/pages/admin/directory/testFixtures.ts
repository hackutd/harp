import type { DirectoryAdminProfile } from "./types";

/** Full moderation-row fixture for tests, with per-test overrides. */
export function adminProfile(
  overrides: Partial<DirectoryAdminProfile> = {},
): DirectoryAdminProfile {
  return {
    user_id: "u-1",
    email: "bob@example.com",
    display_name: "Bob Builder",
    pronouns: null,
    headshot_url: null,
    skills: [],
    icebreaker_prompt: null,
    icebreaker_answer: null,
    want_to_build: null,
    discoverable: true,
    moderation_hidden_at: null,
    moderation_hidden_by: null,
    moderation_reason: null,
    created_at: "2026-10-01T14:00:00Z",
    ...overrides,
  };
}
