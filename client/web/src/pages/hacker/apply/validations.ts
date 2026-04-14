import { z } from "zod";

import { buildZodSchema } from "@/shared/lib/schema-utils";
import type { ApplicationSchemaField } from "@/types";

// Acknowledgment fields — top-level on Application, not in responses JSONB
export const acknowledgmentsSchema = z.object({
  ack_mlh_coc: z.boolean().refine((val) => val === true, {
    message: "You must agree to the MLH Code of Conduct",
  }),
  ack_mlh_privacy: z.boolean().refine((val) => val === true, {
    message: "You must authorize data sharing with MLH",
  }),
  opt_in_mlh_emails: z.boolean().optional().default(false),
});

/**
 * Build the full application form schema from the dynamic application_schema
 * plus the static acknowledgment fields.
 */
export function buildApplicationSchema(fields: ApplicationSchemaField[]) {
  const responsesSchema = buildZodSchema(fields);
  return responsesSchema.merge(acknowledgmentsSchema);
}

// Select options — provide human-readable labels for field values
export const GENDER_OPTIONS = [
  { value: "male", label: "Male" },
  { value: "female", label: "Female" },
  { value: "non_binary", label: "Non-binary" },
  { value: "prefer_not_to_say", label: "Prefer not to say" },
  { value: "other", label: "Other" },
];

export const RACE_OPTIONS = [
  { value: "american_indian", label: "American Indian or Alaska Native" },
  { value: "asian", label: "Asian" },
  { value: "black", label: "Black or African American" },
  { value: "pacific_islander", label: "Native Hawaiian or Pacific Islander" },
  { value: "white", label: "White" },
  { value: "two_or_more", label: "Two or more races" },
  { value: "prefer_not_to_say", label: "Prefer not to say" },
];

export const ETHNICITY_OPTIONS = [
  { value: "hispanic_latino", label: "Hispanic or Latino" },
  { value: "not_hispanic_latino", label: "Not Hispanic or Latino" },
  { value: "prefer_not_to_say", label: "Prefer not to say" },
];

export const LEVEL_OF_STUDY_OPTIONS = [
  { value: "high_school", label: "High School" },
  { value: "freshman", label: "Freshman (1st year)" },
  { value: "sophomore", label: "Sophomore (2nd year)" },
  { value: "junior", label: "Junior (3rd year)" },
  { value: "senior", label: "Senior (4th+ year)" },
  { value: "graduate", label: "Graduate Student (Masters)" },
  { value: "phd", label: "PhD Student" },
  { value: "bootcamp", label: "Bootcamp" },
  { value: "other", label: "Other" },
];

export const EXPERIENCE_LEVEL_OPTIONS = [
  { value: "beginner", label: "Beginner (< 1 year)" },
  { value: "intermediate", label: "Intermediate (1-3 years)" },
  { value: "advanced", label: "Advanced (3-5 years)" },
  { value: "expert", label: "Expert (5+ years)" },
];

export const SHIRT_SIZE_OPTIONS = [
  { value: "xs", label: "XS" },
  { value: "s", label: "S" },
  { value: "m", label: "M" },
  { value: "l", label: "L" },
  { value: "xl", label: "XL" },
  { value: "xxl", label: "2XL" },
  { value: "xxxl", label: "3XL" },
];

export const DIETARY_RESTRICTION_OPTIONS = [
  { value: "vegan", label: "Vegan" },
  { value: "vegetarian", label: "Vegetarian" },
  { value: "halal", label: "Halal" },
  { value: "nuts", label: "Nut Allergy" },
  { value: "fish", label: "Fish/Shellfish Allergy" },
  { value: "wheat", label: "Wheat/Gluten Free" },
  { value: "dairy", label: "Dairy Free" },
  { value: "eggs", label: "Egg Allergy" },
  { value: "no_beef", label: "No Beef" },
  { value: "no_pork", label: "No Pork" },
];

export const HEARD_ABOUT_OPTIONS = [
  { value: "friend", label: "Friend/Word of mouth" },
  { value: "social_media", label: "Social Media" },
  { value: "university", label: "University/Professor" },
  { value: "mlh", label: "MLH" },
  { value: "search", label: "Google/Search Engine" },
  { value: "previous_event", label: "Previous HackUTD Event" },
  { value: "other", label: "Other" },
];

export const COUNTRY_OPTIONS = [
  { value: "US", label: "United States" },
  { value: "CA", label: "Canada" },
  { value: "MX", label: "Mexico" },
  { value: "IN", label: "India" },
  { value: "CN", label: "China" },
  { value: "GB", label: "United Kingdom" },
  { value: "DE", label: "Germany" },
  { value: "FR", label: "France" },
  { value: "JP", label: "Japan" },
  { value: "KR", label: "South Korea" },
  { value: "BR", label: "Brazil" },
  { value: "AU", label: "Australia" },
  { value: "other", label: "Other" },
];
