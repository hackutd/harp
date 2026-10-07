import {
  deleteRequest,
  getRequest,
  patchRequest,
  postRequest,
  putRequest,
} from "@/shared/lib/api";
import type { ApiResponse } from "@/types";

import type {
  DirectoryCardData,
  DirectoryFilters,
  DirectoryListResponse,
  DirectoryMe,
  DirectoryProfilePayload,
  HeadshotContentType,
} from "./types";

// Must match the x-goog-content-length-range the backend signs for images.
export const MAX_HEADSHOT_SIZE_BYTES = 2 * 1024 * 1024;

export function fetchDirectoryMe(
  signal?: AbortSignal,
): Promise<ApiResponse<DirectoryMe>> {
  return getRequest<DirectoryMe>("/directory/me", "directory card", signal);
}

export function saveDirectoryProfile(
  payload: DirectoryProfilePayload,
): Promise<ApiResponse<DirectoryMe>> {
  return putRequest<DirectoryMe>("/directory/me", payload, "directory card");
}

export function setDirectoryDiscoverable(
  discoverable: boolean,
): Promise<ApiResponse<DirectoryMe>> {
  return patchRequest<DirectoryMe>(
    "/directory/me/discoverable",
    { discoverable },
    "directory visibility",
  );
}

export function confirmDirectoryStatus(): Promise<ApiResponse<DirectoryMe>> {
  return postRequest<DirectoryMe>(
    "/directory/me/confirm-status",
    {},
    "directory status",
  );
}

export function requestHeadshotUploadURL(
  contentType: HeadshotContentType,
): Promise<ApiResponse<{ upload_url: string; headshot_path: string }>> {
  return postRequest(
    "/directory/me/headshot-upload-url",
    { content_type: contentType },
    "headshot upload url",
  );
}

export async function uploadHeadshotToSignedURL(
  uploadURL: string,
  file: File,
): Promise<{ status: number; error?: string }> {
  try {
    const response = await fetch(uploadURL, {
      method: "PUT",
      headers: {
        "Content-Type": file.type,
        "x-goog-content-length-range": `0,${MAX_HEADSHOT_SIZE_BYTES}`,
      },
      body: file,
    });
    if (!response.ok) {
      return {
        status: response.status,
        error: `Photo upload failed with status ${response.status}`,
      };
    }
    return { status: response.status };
  } catch (error) {
    return {
      status: 500,
      error: error instanceof Error ? error.message : "Network error",
    };
  }
}

export function fetchDiscordAuthorizeURL(): Promise<
  ApiResponse<{ url: string }>
> {
  return getRequest("/directory/me/discord/authorize", "Discord link");
}

export function linkDiscord(
  code: string,
  state: string,
): Promise<ApiResponse<DirectoryMe>> {
  return postRequest<DirectoryMe>(
    "/directory/me/discord",
    { code, state },
    "Discord link",
  );
}

export function unlinkDiscord(): Promise<ApiResponse<DirectoryMe>> {
  return deleteRequest<DirectoryMe>("/directory/me/discord", "Discord link");
}

export function directoryQuery(
  filters: DirectoryFilters,
  cursor?: string | null,
): string {
  const params = new URLSearchParams();
  if (filters.intents.length) params.set("intent", filters.intents.join(","));
  if (filters.tags.length) params.set("tags", filters.tags.join(","));
  if (filters.q.trim()) params.set("q", filters.q.trim());
  if (filters.checkedIn) params.set("checked_in", "true");
  if (filters.hidden) params.set("hidden", "true");
  if (cursor) params.set("cursor", cursor);
  const qs = params.toString();
  return qs ? `?${qs}` : "";
}

export function fetchDirectory(
  filters: DirectoryFilters,
  cursor?: string | null,
  signal?: AbortSignal,
): Promise<ApiResponse<DirectoryListResponse>> {
  return getRequest<DirectoryListResponse>(
    `/directory/profiles${directoryQuery(filters, cursor)}`,
    "directory",
    signal,
  );
}

export function fetchDirectoryPokes(
  signal?: AbortSignal,
): Promise<ApiResponse<{ cards: DirectoryCardData[] }>> {
  return getRequest("/directory/pokes", "pokes", signal);
}

export function fetchDirectoryContacts(
  signal?: AbortSignal,
): Promise<ApiResponse<{ cards: DirectoryCardData[] }>> {
  return getRequest("/directory/contacts", "contacts", signal);
}

export function pokeAttendee(
  userID: string,
): Promise<ApiResponse<{ matched: boolean; card: DirectoryCardData }>> {
  return postRequest(`/directory/profiles/${userID}/poke`, {}, "poke");
}

export function addContact(
  userID: string,
): Promise<ApiResponse<{ card: DirectoryCardData }>> {
  return putRequest(`/directory/contacts/${userID}`, {}, "contact");
}

export function removeContact(userID: string): Promise<ApiResponse<unknown>> {
  return deleteRequest(`/directory/contacts/${userID}`, "contact");
}

export function hideAttendee(userID: string): Promise<ApiResponse<unknown>> {
  return putRequest(`/directory/hidden/${userID}`, {}, "hide");
}

export function unhideAttendee(userID: string): Promise<ApiResponse<unknown>> {
  return deleteRequest(`/directory/hidden/${userID}`, "hide");
}
