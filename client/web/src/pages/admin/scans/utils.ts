import { Gift, MoreHorizontal, UserCheck, Utensils } from "lucide-react";

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
  const names = types.map((st) => st.name.trim());
  if (new Set(names).size !== names.length) {
    return "Scan type names must be unique";
  }
  const checkInCount = types.filter((st) => st.category === "check_in").length;
  if (checkInCount !== 1) {
    return "Exactly one scan type must have the check_in category";
  }
  return null;
}

export const categoryIcons: Record<ScanTypeCategory, typeof UserCheck> = {
  check_in: UserCheck,
  meal: Utensils,
  swag: Gift,
  other: MoreHorizontal,
};

export const categoryColors: Record<ScanTypeCategory, string> = {
  check_in: "bg-blue-100 text-blue-800",
  meal: "bg-orange-100 text-orange-800",
  swag: "bg-purple-100 text-purple-800",
  other: "bg-gray-100 text-gray-800",
};

export const categoryOptions = [
  { value: "check_in", label: "Check In" },
  { value: "meal", label: "Meal" },
  { value: "swag", label: "Swag" },
  { value: "other", label: "Other" },
] as const;
