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
  UnseenPokes,
} from "./types";

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

export function fetchSentPokes(
  signal?: AbortSignal,
): Promise<ApiResponse<{ cards: DirectoryCardData[] }>> {
  return getRequest("/directory/pokes/sent", "pokes", signal);
}

export function fetchUnseenPokes(
  signal?: AbortSignal,
): Promise<ApiResponse<UnseenPokes>> {
  return getRequest<UnseenPokes>("/directory/pokes/unseen", "pokes", signal);
}

// through is the related_at of the newest poke shown, passed back verbatim:
// a Date would drop the microseconds and leave that poke unseen.
export function markPokesSeen(through: string): Promise<ApiResponse<unknown>> {
  return postRequest("/directory/pokes/seen", { through }, "pokes");
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
