import { getRequest, postRequest, putRequest } from "@/shared/lib/api";
import type { ApiResponse } from "@/types";

import type {
  MealGroupsResult,
  MealGroupStatsResult,
  ResetHackathonOptions,
  ResetHackathonResult,
} from "./types";

export async function resetHackathon(
  options: ResetHackathonOptions,
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
