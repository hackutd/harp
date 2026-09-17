export interface TagColor {
  color: string;
  label: string;
}

// Keyed by lowercased tag name. Values reference the shared CSS palette in
// branding/theme.css so the schedule, Tailwind utilities, and charts cannot
// drift apart.
export const TAG_COLORS: Record<string, TagColor> = {
  required: { color: "var(--portal-red)", label: "Required" },
  "company events": {
    color: "var(--portal-orange)",
    label: "Company Events",
  },
  food: { color: "var(--portal-green)", label: "Food" },
  workshops: { color: "var(--portal-blue)", label: "Workshops" },
  "for fun": { color: "var(--portal-purple)", label: "For Fun" },
};

export const FALLBACK_TAG_COLOR: TagColor = {
  color: "var(--portal-neutral)",
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
