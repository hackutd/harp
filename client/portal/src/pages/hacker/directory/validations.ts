import { z } from "zod";

import type {
  DirectoryIntent,
  DirectoryProfile,
  DirectoryProfilePayload,
} from "./types";

export const INTENTS = [
  "looking_for_teammates",
  "partial_team",
  "team_set",
  "just_networking",
] as const satisfies readonly DirectoryIntent[];

// Skills hold the interests a hacker types in themselves, beside the listed
// interest tags they pick.
export const MAX_SKILLS = 3;
export const SKILL_MAX = 40;
export const MAX_INTEREST_TAGS = 5;
export const ICEBREAKER_MAX = 200;
export const WANT_TO_BUILD_MAX = 100;
export const MAX_EXPERIENCES = 5;
export const EXPERIENCE_FIELD_MAX = 60;

const experienceField = z
  .string()
  .trim()
  .max(
    EXPERIENCE_FIELD_MAX,
    `Keep it under ${EXPERIENCE_FIELD_MAX} characters`,
  );

export const directoryProfileSchema = z
  .object({
    display_name: z
      .string()
      .trim()
      .min(1, "Add the name people should see")
      .max(60, "Keep it under 60 characters"),
    pronouns: z.string().trim().max(30, "Keep it under 30 characters"),
    skills: z
      .array(
        z
          .string()
          .trim()
          .max(SKILL_MAX, `Keep each one under ${SKILL_MAX} characters`),
      )
      .max(MAX_SKILLS, `Add up to ${MAX_SKILLS} of your own`),
    interest_tags: z
      .array(z.string())
      .max(MAX_INTEREST_TAGS, `Pick up to ${MAX_INTEREST_TAGS}`),
    roles_looking_for: z.array(z.string()),
    icebreaker_prompt: z.string(),
    icebreaker_answer: z
      .string()
      .trim()
      .max(ICEBREAKER_MAX, `Keep it under ${ICEBREAKER_MAX} characters`),
    want_to_build: z
      .string()
      .trim()
      .max(WANT_TO_BUILD_MAX, `Keep it under ${WANT_TO_BUILD_MAX} characters`),
    // Handles or pasted profile links; the server reduces both to a handle.
    github_username: z.string().trim().max(200, "That link is too long"),
    linkedin_handle: z.string().trim().max(200, "That link is too long"),
    experiences: z
      .array(z.object({ company: experienceField, title: experienceField }))
      .max(MAX_EXPERIENCES),
    intent: z.enum(INTENTS),
    spots_needed: z.number().int().min(1).max(5).nullable(),
  })
  .superRefine((v, ctx) => {
    if (v.intent === "partial_team" && !v.spots_needed) {
      ctx.addIssue({
        code: "custom",
        path: ["spots_needed"],
        message: "How many spots are open?",
      });
    }
    v.experiences.forEach((e, i) => {
      const company = e.company.trim();
      const title = e.title.trim();
      if (company && !title) {
        ctx.addIssue({
          code: "custom",
          path: ["experiences", i, "title"],
          message: "Add your role",
        });
      }
      if (title && !company) {
        ctx.addIssue({
          code: "custom",
          path: ["experiences", i, "company"],
          message: "Add the company",
        });
      }
    });
    if (v.icebreaker_answer.trim() && !v.icebreaker_prompt) {
      ctx.addIssue({
        code: "custom",
        path: ["icebreaker_prompt"],
        message: "Pick a prompt for your answer",
      });
    }
  });

export type DirectoryProfileForm = z.infer<typeof directoryProfileSchema>;

export function profileToForm(
  profile: DirectoryProfile | null,
  fallbackName = "",
): DirectoryProfileForm {
  // A status that's no longer offered falls back to the default.
  const intent = INTENTS.find((i) => i === profile?.intent);
  return {
    display_name: profile?.display_name ?? fallbackName,
    pronouns: profile?.pronouns ?? "",
    skills: [...(profile?.skills ?? [])],
    interest_tags: profile?.interest_tags ?? [],
    roles_looking_for: profile?.roles_looking_for ?? [],
    icebreaker_prompt: profile?.icebreaker_prompt ?? "",
    icebreaker_answer: profile?.icebreaker_answer ?? "",
    want_to_build: profile?.want_to_build ?? "",
    github_username: profile?.github_username ?? "",
    linkedin_handle: profile?.linkedin_handle ?? "",
    experiences: (profile?.experiences ?? []).map((e) => ({ ...e })),
    intent: intent ?? "looking_for_teammates",
    spots_needed: profile?.spots_needed ?? null,
  };
}

const orNull = (v: string) => (v.trim() ? v.trim() : null);

export function formToPayload(
  form: DirectoryProfileForm,
  discoverable?: boolean,
): DirectoryProfilePayload {
  const answer = orNull(form.icebreaker_answer);
  return {
    display_name: form.display_name.trim(),
    pronouns: orNull(form.pronouns),
    skills: form.skills.map((s) => s.trim()).filter(Boolean),
    interest_tags: form.interest_tags,
    roles_looking_for: form.roles_looking_for,
    icebreaker_prompt: answer ? orNull(form.icebreaker_prompt) : null,
    icebreaker_answer: answer,
    want_to_build: orNull(form.want_to_build),
    github_username: orNull(form.github_username),
    linkedin_handle: orNull(form.linkedin_handle),
    experiences: form.experiences
      .map((e) => ({ company: e.company.trim(), title: e.title.trim() }))
      .filter((e) => e.company || e.title),
    intent: form.intent,
    spots_needed: form.intent === "partial_team" ? form.spots_needed : null,
    // Only honored when the card is created; afterwards visibility has its
    // own endpoint so an edit never flips it.
    ...(discoverable === undefined ? {} : { discoverable }),
  };
}
