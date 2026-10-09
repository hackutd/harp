import { getRequest, patchRequest } from "@/shared/lib/api";
import type { ApiResponse } from "@/types";

import type {
  DirectoryAdminListResponse,
  DirectoryModerationPayload,
} from "./types";

export function directoryAdminQuery(
  search: string,
  cursor?: string | null,
): string {
  const params = new URLSearchParams();
  if (search.trim()) params.set("search", search.trim());
  if (cursor) params.set("cursor", cursor);
  const qs = params.toString();
  return qs ? `?${qs}` : "";
}

export async function fetchDirectoryProfiles(
  search: string,
  cursor?: string | null,
  signal?: AbortSignal,
): Promise<ApiResponse<DirectoryAdminListResponse>> {
  return getRequest<DirectoryAdminListResponse>(
    `/admin/directory/profiles${directoryAdminQuery(search, cursor)}`,
    "directory cards",
    signal,
  );
}

export async function moderateDirectoryProfile(
  userID: string,
  payload: DirectoryModerationPayload,
): Promise<ApiResponse<unknown>> {
  return patchRequest<unknown>(
    `/admin/directory/profiles/${userID}/moderation`,
    payload,
    "directory moderation",
  );
}
