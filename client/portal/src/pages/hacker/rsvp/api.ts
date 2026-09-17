import { getRequest, postRequest } from "@/shared/lib/api";
import type { ApiResponse } from "@/types";

import type { RSVPInfo, SubmitRSVPPayload } from "./types";

export async function fetchMyRSVP(
  signal?: AbortSignal,
): Promise<ApiResponse<RSVPInfo>> {
  return getRequest<RSVPInfo>("/applications/me/rsvp", "RSVP", signal);
}

export async function submitMyRSVP(
  payload: SubmitRSVPPayload,
): Promise<ApiResponse<RSVPInfo>> {
  return postRequest<RSVPInfo>("/applications/me/rsvp", payload, "RSVP");
}
