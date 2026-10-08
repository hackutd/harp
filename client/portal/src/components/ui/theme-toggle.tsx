import { IconMoon, IconSun } from "@tabler/icons-react";
import type * as React from "react";

import { cn } from "@/shared/lib/utils";

interface ThemeToggleProps extends Omit<
  React.ComponentProps<"button">,
  "onClick" | "role"
> {
  /** On is dark mode. */
  dark: boolean;
  onDarkChange: (dark: boolean) => void;
}

/**
 * A light/dark switch, a little larger than the shadcn Switch (52 x 28px): the knob
 * carries the current mode's icon and slides across, and the other mode's
 * icon waits faintly on the free side. Colours come from the theme tokens, so
 * it repaints with the portal as it flips.
 */
export function ThemeToggle({
  dark,
  onDarkChange,
  className,
  ...props
}: ThemeToggleProps) {
  const KnobIcon = dark ? IconMoon : IconSun;
  const IdleIcon = dark ? IconSun : IconMoon;

  return (
    <button
      type="button"
      role="switch"
      aria-checked={dark}
      data-slot="theme-toggle"
      onClick={() => onDarkChange(!dark)}
      className={cn(
        "relative inline-flex h-7 w-13 shrink-0 cursor-pointer items-center rounded-full border border-ink/15 bg-canvas px-px transition-colors duration-300 outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50",
        className,
      )}
      {...props}
    >
      {/* The other mode, on the side the knob is not. */}
      <span
        aria-hidden
        className={cn(
          "absolute left-px flex size-6 items-center justify-center transition-transform duration-300 ease-out motion-reduce:transition-none",
          dark ? "translate-x-6" : "translate-x-0",
        )}
      >
        <IdleIcon className="size-3.5 text-ink/45" strokeWidth={2} />
      </span>
      <span
        aria-hidden
        className={cn(
          "relative flex size-6 items-center justify-center rounded-full bg-surface-2 transition-transform duration-300 ease-out motion-reduce:transition-none",
          dark ? "translate-x-0" : "translate-x-6",
        )}
      >
        <KnobIcon className="size-3.5 text-ink" strokeWidth={2} />
      </span>
    </button>
  );
}
