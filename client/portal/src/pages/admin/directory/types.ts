export interface DirectoryAdminProfile {
  user_id: string;
  email: string;
  display_name: string;
  pronouns: string | null;
  headshot_url: string | null;
  skills: string[];
  icebreaker_prompt: string | null;
  icebreaker_answer: string | null;
  want_to_build: string | null;
  github_username: string | null;
  linkedin_handle: string | null;
  experiences: { company: string; title: string }[];
  discoverable: boolean;
  moderation_hidden_at: string | null;
  moderation_hidden_by: string | null;
  moderation_reason: string | null;
  created_at: string;
}

export interface DirectoryAdminListResponse {
  profiles: DirectoryAdminProfile[];
  next_cursor: string | null;
}

export interface DirectoryModerationPayload {
  hidden: boolean;
  reason?: string | null;
}

export type DirectoryCardStatus = "moderated" | "hidden_by_owner" | "visible";
