// Mirrors UpdateDirectoryInterestTagsPayload on the backend.
export const MAX_DIRECTORY_TAGS = 50;
export const MAX_DIRECTORY_TAG_LENGTH = 30;

/** Returns the first problem with a tag list, or null when it can be saved. */
export function validateDirectoryTags(tags: string[]): string | null {
  const trimmed = tags.map((t) => t.trim());
  if (trimmed.length > MAX_DIRECTORY_TAGS) {
    return `You can have at most ${MAX_DIRECTORY_TAGS} tags.`;
  }
  if (trimmed.some((t) => t.length === 0)) {
    return "Tags cannot be empty.";
  }
  if (trimmed.some((t) => t.length > MAX_DIRECTORY_TAG_LENGTH)) {
    return `Tags must be at most ${MAX_DIRECTORY_TAG_LENGTH} characters.`;
  }
  const seen = new Set<string>();
  for (const t of trimmed) {
    if (seen.has(t)) return `Duplicate tag: ${t}`;
    seen.add(t);
  }
  return null;
}
