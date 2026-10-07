import { describe, expect, it } from "vitest";

import {
  MAX_DIRECTORY_TAG_LENGTH,
  MAX_DIRECTORY_TAGS,
  validateDirectoryTags,
} from "./directoryTags";

describe("validateDirectoryTags", () => {
  it.each([
    ["an empty list", [], null],
    ["distinct tags", ["AI/ML", "Design"], null],
    ["a tag at the length limit", ["a".repeat(MAX_DIRECTORY_TAG_LENGTH)], null],
    [
      "the maximum number of tags",
      Array.from({ length: MAX_DIRECTORY_TAGS }, (_, i) => `t${i}`),
      null,
    ],
    ["a blank tag", ["AI/ML", "  "], "Tags cannot be empty."],
    [
      "a tag past the length limit",
      ["a".repeat(MAX_DIRECTORY_TAG_LENGTH + 1)],
      `Tags must be at most ${MAX_DIRECTORY_TAG_LENGTH} characters.`,
    ],
    ["duplicates after trimming", ["AI/ML", " AI/ML "], "Duplicate tag: AI/ML"],
    [
      "one tag past the maximum",
      Array.from({ length: MAX_DIRECTORY_TAGS + 1 }, (_, i) => `t${i}`),
      `You can have at most ${MAX_DIRECTORY_TAGS} tags.`,
    ],
  ])("handles %s", (_label, tags, expected) => {
    expect(validateDirectoryTags(tags)).toBe(expected);
  });
});
