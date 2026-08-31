import { getRequest, postRequest, putRequest } from "@/shared/lib/api";
import type { ApiResponse } from "@/types";

import type {
  DateSettingResult,
  EmailSettingResult,
  FromNameResult,
  HackathonDateRangeResult,
  HackathonNameResult,
  HackerPackURLResult,
  MealGroupsResult,
  MealGroupStatsResult,
  OnboardingStatus,
  PointsEnabledResult,
  PointsNameResult,
  ResetHackathonOptions,
  ResetHackathonResult,
  URLSettingResult,
} from "./types";

// Partial: omitted domains default to false server-side, which lets targeted
// callers (e.g. "clear the schedule") name only what they mean to reset.
export async function resetHackathon(
  options: Partial<ResetHackathonOptions>,
): Promise<ApiResponse<ResetHackathonResult>> {
  return postRequest<ResetHackathonResult>(
    "/superadmin/reset-hackathon",
    options,
  );
}

export async function fetchMealGroups(
  signal?: AbortSignal,
): Promise<ApiResponse<MealGroupsResult>> {
  return getRequest<MealGroupsResult>(
    "/superadmin/settings/meal-groups",
    "meal groups",
    signal,
  );
}

export async function updateMealGroups(
  groups: string[],
): Promise<ApiResponse<MealGroupsResult>> {
  return putRequest<MealGroupsResult>(
    "/superadmin/settings/meal-groups",
    { groups },
    "meal groups",
  );
}

export async function fetchMealGroupStats(
  signal?: AbortSignal,
): Promise<ApiResponse<MealGroupStatsResult>> {
  return getRequest<MealGroupStatsResult>(
    "/superadmin/settings/meal-groups/stats",
    "meal group stats",
    signal,
  );
}

export async function fetchHackerPackURL(
  signal?: AbortSignal,
): Promise<ApiResponse<HackerPackURLResult>> {
  return getRequest<HackerPackURLResult>(
    "/superadmin/settings/hacker-pack-url",
    "hacker pack URL",
    signal,
  );
}

export async function updateHackerPackURL(
  url: string,
): Promise<ApiResponse<HackerPackURLResult>> {
  return postRequest<HackerPackURLResult>(
    "/superadmin/settings/hacker-pack-url",
    { url },
    "hacker pack URL",
  );
}

export async function fetchOnboardingStatus(
  signal?: AbortSignal,
): Promise<ApiResponse<OnboardingStatus>> {
  return getRequest<OnboardingStatus>(
    "/superadmin/settings/onboarding-status",
    "onboarding status",
    signal,
  );
}

export async function fetchHackathonName(
  signal?: AbortSignal,
): Promise<ApiResponse<HackathonNameResult>> {
  return getRequest<HackathonNameResult>(
    "/superadmin/settings/hackathon-name",
    "hackathon name",
    signal,
  );
}

export async function updateHackathonName(
  name: string,
): Promise<ApiResponse<HackathonNameResult>> {
  return postRequest<HackathonNameResult>(
    "/superadmin/settings/hackathon-name",
    { name },
    "hackathon name",
  );
}

export async function fetchHackathonDateRange(
  signal?: AbortSignal,
): Promise<ApiResponse<HackathonDateRangeResult>> {
  return getRequest<HackathonDateRangeResult>(
    "/superadmin/settings/hackathon-date-range",
    "hackathon date range",
    signal,
  );
}

export async function updateHackathonDateRange(
  startDate: string,
  endDate: string,
): Promise<ApiResponse<HackathonDateRangeResult>> {
  return postRequest<HackathonDateRangeResult>(
    "/superadmin/settings/hackathon-date-range",
    { start_date: startDate, end_date: endDate },
    "hackathon date range",
  );
}

export async function fetchContactEmail(
  signal?: AbortSignal,
): Promise<ApiResponse<EmailSettingResult>> {
  return getRequest<EmailSettingResult>(
    "/superadmin/settings/contact-email",
    "contact email",
    signal,
  );
}

export async function updateContactEmail(
  email: string,
): Promise<ApiResponse<EmailSettingResult>> {
  return postRequest<EmailSettingResult>(
    "/superadmin/settings/contact-email",
    { email },
    "contact email",
  );
}

export async function fetchFromEmail(
  signal?: AbortSignal,
): Promise<ApiResponse<EmailSettingResult>> {
  return getRequest<EmailSettingResult>(
    "/superadmin/settings/from-email",
    "sender email",
    signal,
  );
}

export async function updateFromEmail(
  email: string,
): Promise<ApiResponse<EmailSettingResult>> {
  return postRequest<EmailSettingResult>(
    "/superadmin/settings/from-email",
    { email },
    "sender email",
  );
}

export async function fetchFromName(
  signal?: AbortSignal,
): Promise<ApiResponse<FromNameResult>> {
  return getRequest<FromNameResult>(
    "/superadmin/settings/from-name",
    "sender name",
    signal,
  );
}

export async function updateFromName(
  name: string,
): Promise<ApiResponse<FromNameResult>> {
  return postRequest<FromNameResult>(
    "/superadmin/settings/from-name",
    { name },
    "sender name",
  );
}

export async function fetchApplicationDueDate(
  signal?: AbortSignal,
): Promise<ApiResponse<DateSettingResult>> {
  return getRequest<DateSettingResult>(
    "/superadmin/settings/application-due-date",
    "application due date",
    signal,
  );
}

export async function updateApplicationDueDate(
  date: string,
): Promise<ApiResponse<DateSettingResult>> {
  return postRequest<DateSettingResult>(
    "/superadmin/settings/application-due-date",
    { date },
    "application due date",
  );
}

// Reads go through usePointsConfigStore — the points config is visible to every
// authenticated user, so only the writes are super admin gated.
export async function updatePointsName(
  name: string,
): Promise<ApiResponse<PointsNameResult>> {
  return postRequest<PointsNameResult>(
    "/superadmin/settings/points-name",
    { name },
    "points name",
  );
}

export async function updatePointsEnabled(
  enabled: boolean,
): Promise<ApiResponse<PointsEnabledResult>> {
  return postRequest<PointsEnabledResult>(
    "/superadmin/settings/points-enabled",
    { enabled },
    "points system enabled",
  );
}

export async function fetchPrivacyPolicyURL(
  signal?: AbortSignal,
): Promise<ApiResponse<URLSettingResult>> {
  return getRequest<URLSettingResult>(
    "/superadmin/settings/privacy-policy-url",
    "privacy policy URL",
    signal,
  );
}

export async function updatePrivacyPolicyURL(
  url: string,
): Promise<ApiResponse<URLSettingResult>> {
  return postRequest<URLSettingResult>(
    "/superadmin/settings/privacy-policy-url",
    { url },
    "privacy policy URL",
  );
}

export async function fetchTermsURL(
  signal?: AbortSignal,
): Promise<ApiResponse<URLSettingResult>> {
  return getRequest<URLSettingResult>(
    "/superadmin/settings/terms-url",
    "terms of service URL",
    signal,
  );
}

export async function updateTermsURL(
  url: string,
): Promise<ApiResponse<URLSettingResult>> {
  return postRequest<URLSettingResult>(
    "/superadmin/settings/terms-url",
    { url },
    "terms of service URL",
  );
}
