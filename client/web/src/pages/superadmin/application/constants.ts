import type { FieldType, SectionName } from "@/types";

export const SECTION_ORDER: SectionName[] = [
  "personal",
  "education",
  "links",
  "experience",
  "short_answers",
  "logistics",
];

export const SECTION_LABELS: Record<SectionName, string> = {
  personal: "Personal Information",
  education: "Education",
  links: "Links & Profiles",
  experience: "Experience",
  short_answers: "Short Answer Questions",
  logistics: "Event Logistics",
};

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
  text: "bg-blue-50 text-blue-700 border-blue-200",
  number: "bg-purple-50 text-purple-700 border-purple-200",
  textarea: "bg-green-50 text-green-700 border-green-200",
  select: "bg-amber-50 text-amber-700 border-amber-200",
  multi_select: "bg-orange-50 text-orange-700 border-orange-200",
  checkbox: "bg-pink-50 text-pink-700 border-pink-200",
  phone: "bg-cyan-50 text-cyan-700 border-cyan-200",
};
