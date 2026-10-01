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
        spends ? "bg-rose-50 text-rose-700" : "bg-emerald-50 text-emerald-700",
        className,
      )}
    >
      {formatPointsDelta(scanType)}
    </span>
  );
}
