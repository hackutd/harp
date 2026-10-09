import { BADGE_COLORS } from "@/shared/lib/badge-colors";
import { cn } from "@/shared/lib/utils";

import type { ScanType } from "../types";
import { formatPointsDelta, spendsPoints } from "../utils";

interface PointsDeltaProps {
  scanType: ScanType;
  pointsName: string;
  className?: string;
}

/** Signed, color-coded points badge: green adds to a balance, red spends it. */
export function PointsDelta({
  scanType,
  pointsName,
  className,
}: PointsDeltaProps) {
  if (!scanType.points) {
    return (
      <span className={cn("tabular-nums text-muted-foreground", className)}>
        0
      </span>
    );
  }

  const spends = spendsPoints(scanType.category);

  return (
    <span
      title={`${spends ? "Costs" : "Awards"} ${scanType.points} ${pointsName}`}
      className={cn(
        "inline-flex items-center rounded-md px-1.5 py-0.5 text-xs font-medium tabular-nums",
        spends ? BADGE_COLORS.red : BADGE_COLORS.green,
        className,
      )}
    >
      {formatPointsDelta(scanType)}
    </span>
  );
}
