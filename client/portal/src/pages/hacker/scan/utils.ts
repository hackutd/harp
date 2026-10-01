import type { ScanType, ScanTypeCategory } from "./types";

/** Shop scans spend a hacker's points; every other category awards them. */
export function spendsPoints(category: ScanTypeCategory): boolean {
  return category === "shop";
}

/** The signed change a scan of this type applies to a hacker's balance. */
export function formatPointsDelta(scanType: ScanType): string {
  if (!scanType.points) return "0";
  return spendsPoints(scanType.category)
    ? `−${scanType.points}`
    : `+${scanType.points}`;
}
