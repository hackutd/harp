import type { DirectoryCardData, DirectoryIntent } from "./types";

export const INTENT_LABELS: Record<DirectoryIntent, string> = {
  looking_for_teammates: "Looking for teammates",
  partial_team: "Team has spots",
  team_set: "Team set",
  open_to_collab: "Open to collab",
  just_networking: "Just networking",
};

export const INTENT_STYLES: Record<DirectoryIntent, string> = {
  looking_for_teammates: "border-[#21FFF0]/35 bg-[#21FFF0]/10 text-[#21FFF0]",
  partial_team: "border-[#F62BE8]/35 bg-[#F62BE8]/10 text-[#FF8FF7]",
  team_set: "border-white/15 bg-white/5 text-white/60",
  open_to_collab: "border-[#A857FF]/40 bg-[#5900FF]/20 text-[#D8C5FF]",
  just_networking: "border-[#FFC83D]/30 bg-[#FFC83D]/10 text-[#FFD86B]",
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
export function discordLink(card: DirectoryCardData): string | null {
  return card.discord_user_id
    ? `https://discord.com/users/${card.discord_user_id}`
    : null;
}

export const COACH_MARK_KEY = "harp:directory-swipe-coach";
