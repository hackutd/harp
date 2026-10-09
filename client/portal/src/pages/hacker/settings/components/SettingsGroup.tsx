import type { ReactNode } from "react";

import { cn } from "@/shared/lib/utils";

interface SettingsGroupProps {
  title: string;
  /** The list's surface: a filled card on the page, an outline in a dialog. */
  className?: string;
  children: ReactNode;
}

/** A labelled list of settings rows, divided by hairlines. */
export function SettingsGroup({
  title,
  className,
  children,
}: SettingsGroupProps) {
  return (
    <section>
      <h2 className="mb-2 text-sm font-light text-ink/65">{title}</h2>
      <div
        className={cn(
          "divide-y divide-ink/10 overflow-hidden rounded-xl",
          className,
        )}
      >
        {children}
      </div>
    </section>
  );
}
