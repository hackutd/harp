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
  "open_to_collab",
  "just_networking",
] as const satisfies readonly DirectoryIntent[];

export const MAX_SKILLS = 3;
export const MAX_INTEREST_TAGS = 5;
export const ICEBREAKER_MAX = 200;
export const WANT_TO_BUILD_MAX = 100;

export const directoryProfileSchema = z
  .object({
    display_name: z
      .string()
      .trim()
      .min(1, "Add the name people should see")
      .max(60, "Keep it under 60 characters"),
    pronouns: z.string().trim().max(30, "Keep it under 30 characters"),
    skills: z
      .array(z.string().trim().max(40, "Keep each skill under 40 characters"))
      .max(MAX_SKILLS),
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
  const skills = [...(profile?.skills ?? [])];
  while (skills.length < MAX_SKILLS) skills.push("");
  return {
    display_name: profile?.display_name ?? fallbackName,
    pronouns: profile?.pronouns ?? "",
    skills,
    interest_tags: profile?.interest_tags ?? [],
    roles_looking_for: profile?.roles_looking_for ?? [],
    icebreaker_prompt: profile?.icebreaker_prompt ?? "",
    icebreaker_answer: profile?.icebreaker_answer ?? "",
    want_to_build: profile?.want_to_build ?? "",
    intent: profile?.intent ?? "looking_for_teammates",
    spots_needed: profile?.spots_needed ?? null,
  };
}

const orNull = (v: string) => (v.trim() ? v.trim() : null);

export function formToPayload(
  form: DirectoryProfileForm,
  headshotPath: string | null,
): DirectoryProfilePayload {
  const answer = orNull(form.icebreaker_answer);
  return {
    display_name: form.display_name.trim(),
    pronouns: orNull(form.pronouns),
    headshot_path: headshotPath,
    skills: form.skills.map((s) => s.trim()).filter(Boolean),
    interest_tags: form.interest_tags,
    roles_looking_for: form.roles_looking_for,
    icebreaker_prompt: answer ? orNull(form.icebreaker_prompt) : null,
    icebreaker_answer: answer,
    want_to_build: orNull(form.want_to_build),
    intent: form.intent,
    spots_needed: form.intent === "partial_team" ? form.spots_needed : null,
  };
}
