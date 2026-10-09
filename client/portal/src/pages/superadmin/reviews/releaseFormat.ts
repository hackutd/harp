import type { DecisionReleaseAudience } from "./types";

export function formatReleaseDate(iso: string): string {
  return new Date(iso).toLocaleString("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

/** A short name for an audience, with the deadline it was resolved against. */
export function audienceLabel(
  audience: DecisionReleaseAudience,
  deadline: string | null,
): string {
  const by = deadline ? formatReleaseDate(deadline) : "the priority deadline";
  switch (audience) {
    case "priority":
      return `Priority (submitted by ${by})`;
    case "non_priority":
      return `Regular (submitted after ${by})`;
    case "everyone":
      return "Everyone";
  }
}

export function plural(count: number, noun: string): string {
  return `${count.toLocaleString()} ${noun}${count === 1 ? "" : "s"}`;
}
