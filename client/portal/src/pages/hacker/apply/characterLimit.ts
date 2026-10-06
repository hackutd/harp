/**
 * Status line for a long-answer box with a character cap. Mirrors the limit
 * the server enforces so the hacker sees the overflow before a save fails.
 */
export function describeCharacterLimit(
  value: unknown,
  maxLength: number,
): { text: string; over: boolean } {
  const length = typeof value === "string" ? value.length : 0;
  const over = length > maxLength;
  if (!over) {
    return {
      text: `${length.toLocaleString()} / ${maxLength.toLocaleString()} characters`,
      over,
    };
  }
  const excess = length - maxLength;
  return {
    text: `Too long: ${excess.toLocaleString()} ${excess === 1 ? "character" : "characters"} over the ${maxLength.toLocaleString()} limit`,
    over,
  };
}
