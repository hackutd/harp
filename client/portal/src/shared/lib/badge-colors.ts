// Badge fills, taken from the hacker schedule's filter palette
// (schedule-colors.ts) so every pill on the hacker, admin, and super-admin
// pages reads as one set: a solid category colour with white text. Two
// exceptions: blue is the hacker brand blue (the link icons) rather than the
// schedule's lighter sky blue, and green comes from --badge-green (index.css):
// the schedule green a step darker on admin pages, and a deeper solid green
// on the hacker theme's dark cards.
export type BadgeColor =
  | "red"
  | "orange"
  | "green"
  | "blue"
  | "purple"
  | "neutral";

export const BADGE_COLORS: Record<BadgeColor, string> = {
  red: "border-transparent bg-(--portal-red) text-white",
  orange: "border-transparent bg-(--portal-orange) text-white",
  green: "border-transparent bg-(--badge-green) text-white",
  blue: "border-transparent bg-(--hacker-blue) text-white",
  purple: "border-transparent bg-(--portal-purple) text-white",
  neutral: "border-transparent bg-(--portal-neutral) text-white",
};
