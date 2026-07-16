export interface TagColor {
  hex: string;
  label: string;
}

// Keyed by lowercased tag name. Names and colors mirror the admin schedule
// composer's preset tags (DEFAULT_SCHEDULE_TAGS + EVENT_COLOR_STYLES, which
// use the Tailwind *-400 palette) so hacker-side filters match admin events.
export const TAG_COLORS: Record<string, TagColor> = {
  required: { hex: "#FF6467", label: "Required" }, // red-400
  "company events": { hex: "#FFB900", label: "Company Events" }, // amber-400
  food: { hex: "#00D492", label: "Food" }, // emerald-400
  workshops: { hex: "#00BCFF", label: "Workshops" }, // sky-400
  "for fun": { hex: "#A684FF", label: "For Fun" }, // violet-400
};

export const FALLBACK_TAG_COLOR: TagColor = { hex: "#9F9FA9", label: "Other" }; // zinc-400

export function tagColor(tags: string[]): TagColor {
  for (const tag of tags) {
    const color = TAG_COLORS[tag.toLowerCase()];
    if (color) return color;
  }
  return FALLBACK_TAG_COLOR;
}

export function withAlpha(hex: string, alpha: number): string {
  const a = Math.round(alpha * 255)
    .toString(16)
    .padStart(2, "0");
  return `${hex}${a}`;
}
