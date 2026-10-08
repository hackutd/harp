import { useLayoutEffect } from "react";

import { resolveTheme } from "@/shared/lib/theme";
import { useUserStore } from "@/shared/stores";
import type { Theme } from "@/types";

const THEME_CLASSES: Record<Theme, string> = {
  dark: "theme-dark",
  light: "theme-light",
};

/** The signed-in user's portal theme. */
export function useTheme(): Theme {
  return resolveTheme(useUserStore((s) => s.user?.theme));
}

/**
 * Paints the portal in `theme` while the calling layout is mounted. The class
 * goes on <body> rather than the layout wrapper so Radix portals (dialogs,
 * menus, tooltips) and the toaster are themed too. Unmounting removes it, so
 * the public pages keep their own colours.
 */
export function useApplyPortalTheme(theme: Theme): void {
  useLayoutEffect(() => {
    const body = document.body;
    const root = document.documentElement;
    const meta = document.querySelector<HTMLMetaElement>(
      'meta[name="color-scheme"]',
    );
    const previousScheme = meta?.content;

    body.classList.add(THEME_CLASSES[theme]);
    root.style.colorScheme = theme;
    if (meta) meta.content = theme;

    return () => {
      body.classList.remove(THEME_CLASSES[theme]);
      root.style.colorScheme = "";
      if (meta && previousScheme !== undefined) meta.content = previousScheme;
    };
  }, [theme]);
}

export function themeClass(theme: Theme): string {
  return THEME_CLASSES[theme];
}
