import { BADGE_COLORS } from "@/shared/lib/badge-colors";

// Pill tones for the hacker pages. Green, amber, and red are reserved for
// outcomes (accepted, waitlisted, rejected, and their travel/RSVP cousins);
// everything pre-decision or informational stays inside the palette.
export type Tone = "neutral" | "info" | "success" | "warning" | "danger";

export const PILL_BASE =
  "inline-block rounded-full px-3.5 py-1.5 text-[11px] font-medium tracking-wide";

// Solid fills from the shared badge palette, so the pills match the admin
// badges and stay opaque over the sky-backed status cards. Info is the
// exception: a frosted blue glass pill over the sky art, so a pre-decision
// status doesn't read as a second copy of the solid blue action button.
export const TONE_STYLES: Record<Tone, string> = {
  neutral: BADGE_COLORS.neutral,
  info: "bg-(--portal-blue)/20 text-white shadow-[inset_0_1px_0_rgb(255_255_255/0.18)] backdrop-blur-md backdrop-saturate-150",
  success: BADGE_COLORS.green,
  warning: BADGE_COLORS.orange,
  danger: BADGE_COLORS.red,
};

export function pillClass(tone: Tone): string {
  return `${PILL_BASE} ${TONE_STYLES[tone]}`;
}
