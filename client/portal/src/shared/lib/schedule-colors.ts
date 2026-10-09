export interface TagColor {
  color: string;
  /** Text colour that stays legible on a solid `color` fill. */
  ink: string;
  label: string;
}

// Schedule categories intentionally keep main's shared palette, independent
// of the hacker brand colors. Preserve these mappings for filters and events.
// `ink` is the text colour on a solid fill (the selected event).
export const TAG_COLORS: Record<string, TagColor> = {
  required: { color: "var(--portal-red)", ink: "#ffffff", label: "Required" },
  "company events": {
    color: "var(--portal-orange)",
    ink: "#000000",
    label: "Company Events",
  },
  food: {
    color: "var(--portal-green)",
    ink: "#000000",
    label: "Food",
  },
  workshops: {
    color: "var(--portal-blue)",
    ink: "#000000",
    label: "Workshops",
  },
  "for fun": {
    color: "var(--portal-purple)",
    ink: "#000000",
    label: "For Fun",
  },
};

export const FALLBACK_TAG_COLOR: TagColor = {
  color: "var(--portal-neutral)",
  ink: "#000000",
  label: "Other",
};

export function tagColor(tags: string[]): TagColor {
  for (const tag of tags) {
    const color = TAG_COLORS[tag.toLowerCase()];
    if (color) return color;
  }
  return FALLBACK_TAG_COLOR;
}

export function withAlpha(color: string, alpha: number): string {
  const percentage = Math.round(Math.min(1, Math.max(0, alpha)) * 100);
  return `color-mix(in srgb, ${color} ${percentage}%, transparent)`;
}
