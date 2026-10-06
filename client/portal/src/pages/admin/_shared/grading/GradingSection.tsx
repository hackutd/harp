import type { ReactNode } from "react";

import { cn } from "@/shared/lib/utils";

export const SECTION_TITLE =
  "text-[11px] font-normal uppercase tracking-wider text-foreground";

/** A chosen decision reads as solid; everything else stays outlined. */
export const SELECTED_BUTTON =
  "border-foreground bg-foreground text-background hover:bg-foreground/90 hover:text-background";

export function SectionHeader({
  title,
  aside,
  ruled = false,
}: {
  title: string;
  aside?: ReactNode;
  /** Draw a full-width line under the header. */
  ruled?: boolean;
}) {
  return (
    <div
      className={cn(
        "flex items-center justify-between gap-3 px-5 py-4",
        ruled && "border-b",
      )}
    >
      <h3 className={SECTION_TITLE}>{title}</h3>
      {aside && (
        <span className="text-xs tabular-nums text-muted-foreground">
          {aside}
        </span>
      )}
    </div>
  );
}
