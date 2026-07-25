import {
  DoorOpen,
  Gift,
  MoreHorizontal,
  ShoppingCart,
  UserCheck,
  Utensils,
} from "lucide-react";

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

export const categoryIcons: Record<ScanTypeCategory, typeof UserCheck> = {
  check_in: UserCheck,
  meal: Utensils,
  swag: Gift,
  other: MoreHorizontal,
  walk_in: DoorOpen,
  shop: ShoppingCart,
};

export const categoryColors: Record<ScanTypeCategory, string> = {
  check_in: "bg-blue-100 text-blue-800",
  meal: "bg-orange-100 text-orange-800",
  swag: "bg-purple-100 text-purple-800",
  other: "bg-gray-100 text-gray-800",
  walk_in: "bg-violet-100 text-violet-700",
  shop: "bg-emerald-100 text-emerald-800",
};

export const categoryOptions = [
  { value: "check_in", label: "Check In" },
  { value: "meal", label: "Meal" },
  { value: "swag", label: "Swag" },
  { value: "other", label: "Other" },
  { value: "walk_in", label: "Walk-In" },
  { value: "shop", label: "Shop" },
] as const;
