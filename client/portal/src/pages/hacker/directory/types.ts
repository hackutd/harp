export type DirectoryIntent =
  | "looking_for_teammates"
  | "partial_team"
  | "team_set"
  | "open_to_collab"
  | "just_networking";

export interface DirectoryProfile {
  user_id: string;
  display_name: string;
  pronouns: string | null;
  headshot_path: string | null;
  headshot_url: string | null;
  skills: string[];
  interest_tags: string[];
  roles_looking_for: string[];
  icebreaker_prompt: string | null;
  icebreaker_answer: string | null;
  want_to_build: string | null;
  intent: DirectoryIntent;
  spots_needed: number | null;
  discoverable: boolean;
  status_confirmed_at: string;
  discord_user_id: string | null;
  discord_username: string | null;
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
}

export interface DirectoryMe {
  eligible: boolean;
  profile: DirectoryProfile | null;
  status_stale: boolean;
  event_near: boolean;
  rsvp_discord_username: string | null;
  discord_oauth_enabled: boolean;
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
  discord_user_id: string | null;
  discord_username: string | null;
  related_at?: string;
}

export interface DirectoryProfilePayload {
  display_name: string;
  pronouns: string | null;
  headshot_path: string | null;
  skills: string[];
  interest_tags: string[];
  roles_looking_for: string[];
  icebreaker_prompt: string | null;
  icebreaker_answer: string | null;
  want_to_build: string | null;
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

export type HeadshotContentType = "image/jpeg" | "image/png" | "image/webp";
