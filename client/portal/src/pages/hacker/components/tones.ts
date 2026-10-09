import { BADGE_COLORS } from "@/shared/lib/badge-colors";

// Pill tones for the hacker pages. Green, amber, and red are reserved for
// outcomes (accepted, waitlisted, rejected, and their travel/RSVP cousins);
// everything pre-decision or informational stays inside the palette.
export type Tone = "neutral" | "info" | "success" | "warning" | "danger";

export const PILL_BASE =
  "inline-block rounded-full px-3.5 py-1.5 text-[11px] font-medium tracking-wide";

// Solid fills from the shared badge palette, so the pills match the admin
// badges and stay opaque over the sky-backed status cards.
export const TONE_STYLES: Record<Tone, string> = {
  neutral: BADGE_COLORS.neutral,
  info: BADGE_COLORS.blue,
  success: BADGE_COLORS.green,
  warning: BADGE_COLORS.orange,
  danger: BADGE_COLORS.red,
};

export function pillClass(tone: Tone): string {
  return `${PILL_BASE} ${TONE_STYLES[tone]}`;
}
