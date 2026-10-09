import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  readCachedTheme,
  resolveTheme,
  THEME_STORAGE_KEY,
  writeCachedTheme,
} from "./theme";

beforeEach(() => {
  localStorage.clear();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("resolveTheme", () => {
  it.each([
    { user: "light", cached: "dark", expected: "light" },
    { user: "dark", cached: "light", expected: "dark" },
    { user: undefined, cached: "light", expected: "light" },
    { user: null, cached: "light", expected: "light" },
    { user: undefined, cached: "sepia", expected: "dark" },
    { user: undefined, cached: null, expected: "dark" },
  ] as const)(
    "user $user with cache $cached resolves to $expected",
    ({ user, cached, expected }) => {
      if (cached) localStorage.setItem(THEME_STORAGE_KEY, cached);
      expect(resolveTheme(user)).toBe(expected);
    },
  );
});

describe("theme cache", () => {
  it("round-trips a theme", () => {
    writeCachedTheme("light");
    expect(readCachedTheme()).toBe("light");
  });

  it("ignores an unknown stored value", () => {
    localStorage.setItem(THEME_STORAGE_KEY, "blue");
    expect(readCachedTheme()).toBeNull();
  });

  it("survives storage that throws", () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("blocked");
    });
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("blocked");
    });

    expect(() => writeCachedTheme("light")).not.toThrow();
    expect(readCachedTheme()).toBeNull();
    expect(resolveTheme()).toBe("dark");
  });
});
