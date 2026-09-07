import {
  deleteRequest,
  getRequest,
  postRequest,
  putRequest,
} from "@/shared/lib/api";
import type { ApiResponse } from "@/types";

import type { Track, TrackListResponse, TrackPayload } from "./types";

export async function fetchTracks(
  signal?: AbortSignal,
): Promise<ApiResponse<TrackListResponse>> {
  return getRequest<TrackListResponse>("/admin/tracks", "tracks", signal);
}

export async function fetchTrackEditPermission(
  signal?: AbortSignal,
): Promise<ApiResponse<{ enabled: boolean }>> {
  return getRequest<{ enabled: boolean }>(
    "/admin/tracks/edit-permission",
    "track edit permission",
    signal,
  );
}

export async function createTrack(
  payload: TrackPayload,
  signal?: AbortSignal,
): Promise<ApiResponse<Track>> {
  return postRequest<Track>("/admin/tracks", payload, "track", signal);
}

export async function updateTrack(
  id: string,
  payload: TrackPayload,
  signal?: AbortSignal,
): Promise<ApiResponse<Track>> {
  return putRequest<Track>(`/admin/tracks/${id}`, payload, "track", signal);
}

export async function deleteTrack(
  id: string,
  signal?: AbortSignal,
): Promise<ApiResponse<unknown>> {
  return deleteRequest<unknown>(`/admin/tracks/${id}`, "track", signal);
}

export async function uploadTrackLogo(
  trackId: string,
  logoData: string,
  contentType: string,
  signal?: AbortSignal,
): Promise<ApiResponse<Track>> {
  return putRequest<Track>(
    `/admin/tracks/${trackId}/logo`,
    { logo_data: logoData, content_type: contentType },
    "track logo",
    signal,
  );
}
