import {
  IconDoorEnter,
  IconDots,
  IconGift,
  IconShoppingCart,
  IconToolsKitchen2,
  IconUserCheck,
} from "@tabler/icons-react";

import { BADGE_COLORS } from "@/shared/lib/badge-colors";

import type { ScanType, ScanTypeCategory } from "./types";

export function toSnakeCase(str: string): string {
  return str
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_|_$/g, "");
}

export function validate(types: ScanType[]): string | null {
  if (types.some((st) => !st.display_name.trim() || !st.name.trim())) {
    return "All scan types must have a name";
  }
  if (types.some((st) => !Number.isInteger(st.points) || st.points < 0)) {
    return "Points must be a non-negative whole number";
  }
  const names = types.map((st) => st.name.trim());
  if (new Set(names).size !== names.length) {
    return "Scan type names must be unique";
  }
  const hasCheckIn = types.some(
    (st) => st.is_active && st.category === "check_in",
  );
  if (!hasCheckIn) {
    return "At least one active check_in scan type is required";
  }
  const hasWalkIn = types.some(
    (st) => st.is_active && st.category === "walk_in",
  );
  if (!hasWalkIn) {
    return "At least one active walk_in scan type is required";
  }
  return null;
}

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

export const categoryIcons: Record<ScanTypeCategory, typeof IconUserCheck> = {
  check_in: IconUserCheck,
  meal: IconToolsKitchen2,
  swag: IconGift,
  other: IconDots,
  walk_in: IconDoorEnter,
  shop: IconShoppingCart,
};

export const categoryColors: Record<ScanTypeCategory, string> = {
  check_in: BADGE_COLORS.blue,
  meal: BADGE_COLORS.orange,
  swag: BADGE_COLORS.purple,
  other: BADGE_COLORS.neutral,
  walk_in: BADGE_COLORS.green,
  shop: BADGE_COLORS.red,
};

export const categoryOptions = [
  { value: "check_in", label: "Check In" },
  { value: "meal", label: "Meal" },
  { value: "swag", label: "Swag" },
  { value: "other", label: "Other" },
  { value: "walk_in", label: "Walk-In" },
  { value: "shop", label: "Shop" },
] as const;
