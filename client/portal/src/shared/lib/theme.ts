import type { Theme } from "@/types";

export const DEFAULT_THEME: Theme = "dark";

// The last theme this browser saw for the signed-in user, so the portal paints
// in the right scheme before /auth/me answers.
export const THEME_STORAGE_KEY = "harp.theme";

export function isTheme(value: unknown): value is Theme {
  return value === "light" || value === "dark";
}

export function readCachedTheme(): Theme | null {
  try {
    const value = localStorage.getItem(THEME_STORAGE_KEY);
    return isTheme(value) ? value : null;
  } catch {
    return null;
  }
}

export function writeCachedTheme(theme: Theme): void {
  try {
    localStorage.setItem(THEME_STORAGE_KEY, theme);
  } catch {
    // Storage can be unavailable (private mode, blocked site data); the
    // server still has the preference.
  }
}

/** The user's saved theme, else this browser's cached one, else dark. */
export function resolveTheme(userTheme?: Theme | null): Theme {
  if (isTheme(userTheme)) return userTheme;
  return readCachedTheme() ?? DEFAULT_THEME;
}
