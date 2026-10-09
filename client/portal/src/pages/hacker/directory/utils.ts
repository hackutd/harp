import type { MouseEvent } from "react";
import { toast } from "sonner";

import type {
  DirectoryCardData,
  DirectoryIntent,
  DirectoryProfile,
  UnseenPokes,
} from "./types";

const ROLE_LABELS: Record<string, string> = {
  frontend: "Frontend",
  backend: "Backend",
  fullstack: "Full stack",
  mobile: "Mobile",
  ml_ai: "ML / AI",
  data: "Data",
  design: "Design",
  hardware: "Hardware",
  product: "Product",
  pitch: "Pitch",
};

export function roleLabel(role: string): string {
  return ROLE_LABELS[role] ?? role;
}

export const INTENT_LABELS: Record<DirectoryIntent, string> = {
  looking_for_teammates: "Looking for teammates",
  partial_team: "Team has spots",
  team_set: "Team set",
  just_networking: "Just networking",
};

// Solid blue chip with white text, matching the hacker status badges.
export const CHIP_BLUE = "bg-primary text-white";

export const INTENT_STYLES: Record<DirectoryIntent, string> = {
  looking_for_teammates: CHIP_BLUE,
  partial_team: CHIP_BLUE,
  team_set: "bg-ink/[0.03] text-ink/65",
  just_networking: "bg-ink/[0.03] text-ink/65",
};

export function intentLabel(
  intent: DirectoryIntent,
  spots: number | null,
): string {
  if (intent === "partial_team" && spots) {
    return `Team needs ${spots} more`;
  }
  return INTENT_LABELS[intent];
}

export function githubURL(username: string): string {
  return `https://github.com/${encodeURIComponent(username)}`;
}

export function linkedInURL(handle: string): string {
  return `https://www.linkedin.com/in/${encodeURIComponent(handle)}`;
}

export function initials(name: string): string {
  return (
    name
      .split(/\s+/)
      .filter(Boolean)
      .map((p) => p[0])
      .slice(0, 2)
      .join("")
      .toUpperCase() || "?"
  );
}

// Discord's user deep link needs the numeric ID, which only comes from OAuth.
// Without it the best we can do is hand over the username to paste.
// Copies a Discord username for pasting into Add Friend, falling back to
// showing it when the clipboard is blocked.
export async function copyDiscordUsername(username: string): Promise<void> {
  try {
    await navigator.clipboard.writeText(username);
    toast.success(`Copied ${username}`, {
      description: "Paste it into Discord's Add Friend search.",
    });
  } catch {
    toast(username);
  }
}

export const COACH_MARK_KEY = "harp:directory-swipe-coach";

// The hacker's own card as others see it, for previews. Relationship flags
// only make sense between two people, so they are all off.
// photoUrl is the signed-in user's own photo from the user store, so the
// preview follows a photo change without refetching the card.
export function ownCardPreview(
  profile: DirectoryProfile,
  photoUrl: string | null,
  stale = false,
): DirectoryCardData {
  return {
    user_id: profile.user_id,
    display_name: profile.display_name,
    pronouns: profile.pronouns,
    headshot_url: photoUrl,
    skills: profile.skills,
    interest_tags: profile.interest_tags,
    roles_looking_for: profile.roles_looking_for,
    icebreaker_prompt: profile.icebreaker_prompt,
    icebreaker_answer: profile.icebreaker_answer,
    want_to_build: profile.want_to_build,
    github_username: profile.github_username,
    linkedin_handle: profile.linkedin_handle,
    experiences: profile.experiences,
    intent: profile.intent,
    spots_needed: profile.spots_needed,
    status_confirmed_at: profile.status_confirmed_at,
    checked_in: false,
    stale,
    poked_by_me: false,
    poked_me: false,
    matched: false,
    is_contact: false,
    is_hidden: false,
    discord_username: null,
  };
}

// "Ada poked you", "Ada and Grace poked you", "Ada, Grace and 3 others poked
// you". First names keep it to one line on a phone.
export function pokedYouSummary({ count, pokers }: UnseenPokes): string {
  const names = pokers
    .slice(0, count > 2 ? 2 : count)
    .map((p) => p.display_name.trim().split(/\s+/)[0] || "Someone");
  const rest = count - names.length;
  const parts =
    rest > 0 ? [...names, rest === 1 ? "1 other" : `${rest} others`] : names;
  const who =
    parts.length === 1
      ? parts[0]
      : `${parts.slice(0, -1).join(", ")} and ${parts[parts.length - 1]}`;
  return `${who} poked you`;
}

export type PokeSection = "waiting" | "matched" | "sent";

// Splits both directions into the page's three sections. Every match shows up
// in both lists, so matches come from the received side alone.
export function groupPokes(
  received: DirectoryCardData[],
  sent: DirectoryCardData[],
): Record<PokeSection, DirectoryCardData[]> {
  return {
    waiting: received.filter((c) => !c.matched),
    matched: received.filter((c) => c.matched),
    sent: sent.filter((c) => !c.matched),
  };
}

// Opens a list row's card from a click anywhere on it. Buttons and links in
// the row keep their own job; the name stays a button for keyboards.
export function openOnRowClick(open: () => void) {
  return (e: MouseEvent) => {
    if (!(e.target as Element).closest("a, button")) open();
  };
}
