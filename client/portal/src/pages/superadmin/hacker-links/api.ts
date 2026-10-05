import {
  deleteRequest,
  getRequest,
  postRequest,
  putRequest,
} from "@/shared/lib/api";
import type { ApiResponse } from "@/types";

import type {
  HackerLink,
  HackerLinkListResponse,
  HackerLinkPayload,
} from "./types";

export async function fetchHackerLinks(
  signal?: AbortSignal,
): Promise<ApiResponse<HackerLinkListResponse>> {
  return getRequest<HackerLinkListResponse>(
    "/superadmin/hacker-links",
    "hacker links",
    signal,
  );
}

export async function createHackerLink(
  payload: HackerLinkPayload,
  signal?: AbortSignal,
): Promise<ApiResponse<HackerLink>> {
  return postRequest<HackerLink>(
    "/superadmin/hacker-links",
    payload,
    "hacker link",
    signal,
  );
}

export async function updateHackerLink(
  id: string,
  payload: HackerLinkPayload,
  signal?: AbortSignal,
): Promise<ApiResponse<HackerLink>> {
  return putRequest<HackerLink>(
    `/superadmin/hacker-links/${id}`,
    payload,
    "hacker link",
    signal,
  );
}

export async function deleteHackerLink(
  id: string,
  signal?: AbortSignal,
): Promise<ApiResponse<unknown>> {
  return deleteRequest<unknown>(
    `/superadmin/hacker-links/${id}`,
    "hacker link",
    signal,
  );
}
