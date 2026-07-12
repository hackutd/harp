export interface TagColor {
  hex: string;
  label: string;
}

export const TAG_COLORS: Record<string, TagColor> = {
  required: { hex: "#FF0000", label: "Required" },
  social: { hex: "#FFBB00", label: "Social" },
  food: { hex: "#09D082", label: "Food" },
  sponsor: { hex: "#00A8EB", label: "Sponsor" },
  workshop: { hex: "#A259FF", label: "Workshop" },
};

export const FALLBACK_TAG_COLOR: TagColor = { hex: "#B8B8B8", label: "Other" };

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
