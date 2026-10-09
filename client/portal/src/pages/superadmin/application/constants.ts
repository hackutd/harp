import { BADGE_COLORS } from "@/shared/lib/badge-colors";
import type { FieldType } from "@/types";

export const FIELD_TYPE_LABELS: Record<FieldType, string> = {
  text: "Text",
  number: "Number",
  textarea: "Long Text",
  select: "Dropdown",
  multi_select: "Multi Select",
  checkbox: "Checkbox",
  phone: "Phone",
};

export const TYPE_COLORS: Record<FieldType, string> = {
  text: BADGE_COLORS.blue,
  number: BADGE_COLORS.purple,
  textarea: BADGE_COLORS.green,
  select: BADGE_COLORS.orange,
  multi_select: BADGE_COLORS.orange,
  checkbox: BADGE_COLORS.red,
  phone: BADGE_COLORS.blue,
};
