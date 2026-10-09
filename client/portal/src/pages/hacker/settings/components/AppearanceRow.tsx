import { IconMoon, IconSun } from "@tabler/icons-react";

import { ThemeToggle } from "@/components/ui/theme-toggle";
import { useTheme } from "@/shared/hooks";
import { useUserStore } from "@/shared/stores";

/**
 * Settings row for the portal theme. It applies to the hacker and admin
 * portals alike and is saved to the account, so it follows the user across
 * devices.
 */
export function AppearanceRow() {
  const theme = useTheme();
  const updateTheme = useUserStore((s) => s.updateTheme);
  const dark = theme === "dark";
  const Icon = dark ? IconMoon : IconSun;

  return (
    <div className="flex min-h-[68px] items-center justify-between gap-3 px-5 py-4">
      <div className="flex items-center gap-3">
        <Icon className="size-4.5 text-ink" strokeWidth={1.5} />
        <div>
          <label
            htmlFor="profile-dark-mode"
            className="block text-sm font-normal text-ink"
          >
            Dark mode
          </label>
          <p className="text-xs font-light text-ink/65">
            {dark
              ? "Easier on the eyes at night"
              : "A brighter look for daytime"}
          </p>
        </div>
      </div>
      <ThemeToggle
        id="profile-dark-mode"
        dark={dark}
        onDarkChange={(next) => void updateTheme(next ? "dark" : "light")}
      />
    </div>
  );
}
