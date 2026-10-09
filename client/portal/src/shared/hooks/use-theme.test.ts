import { renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { THEME_STORAGE_KEY } from "@/shared/lib/theme";
import { useUserStore } from "@/shared/stores";
import type { User } from "@/types";

import { useApplyPortalTheme, useTheme } from "./use-theme";

function user(overrides: Partial<User> = {}): User {
  return {
    id: "user-1",
    email: "hacker@test.com",
    role: "hacker",
    theme: "dark",
    createdAt: "2026-10-01T15:00:00Z",
    updatedAt: "2026-10-01T15:00:00Z",
    ...overrides,
  };
}

let meta: HTMLMetaElement;

beforeEach(() => {
  localStorage.clear();
  useUserStore.setState(useUserStore.getInitialState(), true);
  meta = document.createElement("meta");
  meta.name = "color-scheme";
  meta.content = "dark";
  document.head.appendChild(meta);
});

afterEach(() => {
  meta.remove();
  document.body.className = "";
});

describe("useTheme", () => {
  it("defaults to dark", () => {
    const { result } = renderHook(() => useTheme());
    expect(result.current).toBe("dark");
  });

  it("uses the cached theme before the user loads", () => {
    localStorage.setItem(THEME_STORAGE_KEY, "light");
    const { result } = renderHook(() => useTheme());
    expect(result.current).toBe("light");
  });

  it("follows the signed-in user's theme", () => {
    localStorage.setItem(THEME_STORAGE_KEY, "dark");
    useUserStore.setState({ user: user({ theme: "light" }) });
    const { result } = renderHook(() => useTheme());
    expect(result.current).toBe("light");
  });
});

describe("useApplyPortalTheme", () => {
  it("swaps the body class and colour scheme when the theme changes", () => {
    const { rerender } = renderHook(({ theme }) => useApplyPortalTheme(theme), {
      initialProps: { theme: "dark" as User["theme"] },
    });
    expect(document.body).toHaveClass("theme-dark");
    expect(document.documentElement.style.colorScheme).toBe("dark");

    rerender({ theme: "light" });
    expect(document.body).toHaveClass("theme-light");
    expect(document.body).not.toHaveClass("theme-dark");
    expect(document.documentElement.style.colorScheme).toBe("light");
    expect(meta.content).toBe("light");
  });

  it("cleans up on unmount", () => {
    const { unmount } = renderHook(() => useApplyPortalTheme("light"));
    unmount();
    expect(document.body).not.toHaveClass("theme-light");
    expect(document.documentElement.style.colorScheme).toBe("");
    expect(meta.content).toBe("dark");
  });
});
