import { getRequest, patchRequest, putRequest } from "@/shared/lib/api";
import type { ApiResponse, UserRole } from "@/types";

import type { FetchUsersParams, UserListResponse } from "./types";

export async function fetchUsers(
  params: FetchUsersParams,
  signal?: AbortSignal,
): Promise<ApiResponse<UserListResponse>> {
  const searchParams = new URLSearchParams();

  const roles = params.roles ?? [];
  for (const role of roles) {
    searchParams.append("role", role);
  }
  searchParams.append("limit", "50");

  if (params.search && params.search.length >= 2) {
    searchParams.append("search", params.search);
  }
  if (params.cursor) {
    searchParams.append("cursor", params.cursor);
  }
  if (params.direction) {
    searchParams.append("direction", params.direction);
  }

  return getRequest<UserListResponse>(
    `/superadmin/users?${searchParams.toString()}`,
    "users",
    signal,
  );
}

export async function updateUserRole(
  userId: string,
  role: UserRole,
): Promise<ApiResponse<{ user: { role: UserRole } }>> {
  return patchRequest<{ user: { role: UserRole } }>(
    `/superadmin/users/${userId}/role`,
    { role },
    "update user role",
  );
}

export async function toggleReviewAssignment(
  userId: string,
  enabled: boolean,
): Promise<ApiResponse<{ user_id: string; enabled: boolean }>> {
  return putRequest<{ user_id: string; enabled: boolean }>(
    "/superadmin/settings/review-assignment-toggle",
    { user_id: userId, enabled },
    "review assignment status",
  );
}
