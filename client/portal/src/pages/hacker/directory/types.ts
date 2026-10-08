export type DirectoryIntent =
  | "looking_for_teammates"
  | "partial_team"
  | "team_set"
  | "just_networking";

export interface DirectoryExperience {
  company: string;
  title: string;
}

export interface DirectoryProfile {
  user_id: string;
  display_name: string;
  pronouns: string | null;
  headshot_url: string | null;
  skills: string[];
  interest_tags: string[];
  roles_looking_for: string[];
  icebreaker_prompt: string | null;
  icebreaker_answer: string | null;
  want_to_build: string | null;
  github_username: string | null;
  linkedin_handle: string | null;
  experiences: DirectoryExperience[];
  intent: DirectoryIntent;
  spots_needed: number | null;
  discoverable: boolean;
  status_confirmed_at: string;
  moderation_hidden: boolean;
  created_at: string;
  updated_at: string;
}

export interface DirectoryOptions {
  interest_tags: string[];
  roles: string[];
  intents: DirectoryIntent[];
  icebreaker_prompts: string[];
  max_skills: number;
  max_interest_tags: number;
  max_experiences: number;
}

export interface DirectoryMe {
  eligible: boolean;
  profile: DirectoryProfile | null;
  status_stale: boolean;
  event_near: boolean;
  rsvp_discord_username: string | null;
  options: DirectoryOptions;
}

export interface DirectoryCardData {
  user_id: string;
  display_name: string;
  pronouns: string | null;
  headshot_url: string | null;
  skills: string[];
  interest_tags: string[];
  roles_looking_for: string[];
  icebreaker_prompt: string | null;
  icebreaker_answer: string | null;
  want_to_build: string | null;
  github_username: string | null;
  linkedin_handle: string | null;
  experiences: DirectoryExperience[];
  intent: DirectoryIntent;
  spots_needed: number | null;
  status_confirmed_at: string;
  checked_in: boolean;
  stale: boolean;
  poked_by_me: boolean;
  poked_me: boolean;
  matched: boolean;
  is_contact: boolean;
  is_hidden: boolean;
  // From their RSVP; only shared once matched.
  discord_username: string | null;
  related_at?: string;
}

// Someone whose poke the viewer hasn't seen yet.
export interface DirectoryPoker {
  user_id: string;
  display_name: string;
  headshot_url: string | null;
}

export interface UnseenPokes {
  count: number;
  // The newest few pokers; count covers the rest.
  pokers: DirectoryPoker[];
}

export interface DirectoryProfilePayload {
  display_name: string;
  pronouns: string | null;
  skills: string[];
  interest_tags: string[];
  roles_looking_for: string[];
  icebreaker_prompt: string | null;
  icebreaker_answer: string | null;
  want_to_build: string | null;
  github_username: string | null;
  linkedin_handle: string | null;
  experiences: DirectoryExperience[];
  intent: DirectoryIntent;
  spots_needed: number | null;
  discoverable?: boolean;
}

export interface DirectoryFilters {
  intents: DirectoryIntent[];
  tags: string[];
  q: string;
  checkedIn: boolean;
  hidden: boolean;
}

export interface DirectoryListResponse {
  cards: DirectoryCardData[];
  next_cursor: string | null;
  event_near: boolean;
}
