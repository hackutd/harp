import { describe, expect, it } from "vitest";

import { describeCharacterLimit } from "./characterLimit";

describe("describeCharacterLimit", () => {
  it.each([
    [undefined, 1000, "0 / 1,000 characters", false],
    ["", 1000, "0 / 1,000 characters", false],
    ["hello", 1000, "5 / 1,000 characters", false],
    ["a".repeat(1000), 1000, "1,000 / 1,000 characters", false],
    [
      "a".repeat(1001),
      1000,
      "Too long: 1 character over the 1,000 limit",
      true,
    ],
    [
      "a".repeat(2345),
      1000,
      "Too long: 1,345 characters over the 1,000 limit",
      true,
    ],
  ])("describes %j against %d", (value, max, text, over) => {
    expect(describeCharacterLimit(value, max)).toEqual({ text, over });
  });
});
