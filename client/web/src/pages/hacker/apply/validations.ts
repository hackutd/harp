import { z } from "zod";

// Step 1: Personal Info
export const personalInfoSchema = z.object({
  first_name: z.string().min(1, "First name is required"),
  last_name: z.string().min(1, "Last name is required"),
  phone_e164: z
    .string()
    .min(1, "Phone number is required")
    .regex(
      /^\+[1-9]\d{1,14}$/,
      "Phone must be in E.164 format (e.g., +12025551234)",
    ),
  age: z.coerce
    .number({ error: "Age is required" })
    .int("Age must be a whole number")
    .min(1, "Age is required")
    .max(150, "Age must be 150 or less"),
  country_of_residence: z.string().min(1, "Country is required"),
  gender: z.string().min(1, "Gender is required"),
  race: z.string().min(1, "Race is required"),
  ethnicity: z.string().min(1, "Ethnicity is required"),
});

// Step 2: School Info
export const schoolInfoSchema = z.object({
  university: z.string().min(1, "University is required"),
  major: z.string().min(1, "Major is required"),
  level_of_study: z.string().min(1, "Level of study is required"),
});

// Step 3: Hackathon Experience
export const experienceSchema = z.object({
  hackathons_attended_count: z.coerce
    .number({ error: "Number of hackathons is required" })
    .int("Must be a whole number")
    .min(0, "Must be 0 or more"),
  software_experience_level: z.string().min(1, "Experience level is required"),
  heard_about: z.string().min(1, "This field is required"),
});

// Step 4: Short Answers (dynamic questions - validation at submit time)
export const shortAnswerSchema = z.object({
  short_answer_responses: z.record(z.string(), z.string()).default({}),
});

// Step 5: Event Info
export const eventInfoSchema = z.object({
  shirt_size: z.string().min(1, "Shirt size is required"),
  dietary_restrictions: z
    .array(
      z.enum([
        "vegan",
        "vegetarian",
        "halal",
        "nuts",
        "fish",
        "wheat",
        "dairy",
        "eggs",
        "no_beef",
        "no_pork",
      ]),
    )
    .optional()
    .default([]),
  accommodations: z.string().optional().default(""),
});

// Step 6: Sponsor Info (all optional)
export const sponsorInfoSchema = z.object({
  github: z.url("Must be a valid URL").optional().or(z.literal("")),
  linkedin: z.url("Must be a valid URL").optional().or(z.literal("")),
  website: z.url("Must be a valid URL").optional().or(z.literal("")),
});

// Step 7: Review - Acknowledgments
export const acknowledgmentsSchema = z.object({
  ack_application: z.boolean().refine((val) => val === true, {
    message: "You must acknowledge this disclaimer",
  }),
  ack_mlh_coc: z.boolean().refine((val) => val === true, {
    message: "You must agree to the MLH Code of Conduct",
  }),
  ack_mlh_privacy: z.boolean().refine((val) => val === true, {
    message: "You must authorize data sharing with MLH",
  }),
  opt_in_mlh_emails: z.boolean().optional().default(false),
});

// Combined schema for full form
export const applicationSchema = z.object({
  ...personalInfoSchema.shape,
  ...schoolInfoSchema.shape,
  ...experienceSchema.shape,
  ...shortAnswerSchema.shape,
  ...eventInfoSchema.shape,
  ...sponsorInfoSchema.shape,
  ...acknowledgmentsSchema.shape,
});

export type ApplicationFormData = z.infer<typeof applicationSchema>;

// Step field mappings for partial validation
export const STEP_FIELDS: Record<number, (keyof ApplicationFormData)[]> = {
  0: [
    "first_name",
    "last_name",
    "phone_e164",
    "age",
    "country_of_residence",
    "gender",
    "race",
    "ethnicity",
  ],
  1: ["university", "major", "level_of_study"],
  2: ["hackathons_attended_count", "software_experience_level", "heard_about"],
  3: ["short_answer_responses"],
  4: ["shirt_size", "dietary_restrictions", "accommodations"],
  5: ["github", "linkedin", "website"],
  6: ["ack_application", "ack_mlh_coc", "ack_mlh_privacy", "opt_in_mlh_emails"],
};

// Step schemas for per-step validation
export const stepSchemas = [
  personalInfoSchema,
  schoolInfoSchema,
  experienceSchema,
  shortAnswerSchema,
  eventInfoSchema,
  sponsorInfoSchema,
  acknowledgmentsSchema,
];

// Select options
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

// Country list (common countries at top)
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
