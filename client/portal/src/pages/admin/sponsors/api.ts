import {
  deleteRequest,
  getRequest,
  postRequest,
  putRequest,
} from "@/shared/lib/api";
import type { ApiResponse } from "@/types";

import type { Sponsor, SponsorListResponse, SponsorPayload } from "./types";

export async function fetchSponsors(
  signal?: AbortSignal,
): Promise<ApiResponse<SponsorListResponse>> {
  return getRequest<SponsorListResponse>("/admin/sponsors", "sponsors", signal);
}

export async function createSponsor(
  payload: SponsorPayload,
  signal?: AbortSignal,
): Promise<ApiResponse<Sponsor>> {
  return postRequest<Sponsor>("/admin/sponsors", payload, "sponsor", signal);
}

export async function updateSponsor(
  id: string,
  payload: SponsorPayload,
  signal?: AbortSignal,
): Promise<ApiResponse<Sponsor>> {
  return putRequest<Sponsor>(
    `/admin/sponsors/${id}`,
    payload,
    "sponsor",
    signal,
  );
}

export async function deleteSponsor(
  id: string,
  signal?: AbortSignal,
): Promise<ApiResponse<unknown>> {
  return deleteRequest<unknown>(`/admin/sponsors/${id}`, "sponsor", signal);
}

export async function uploadSponsorLogo(
  sponsorId: string,
  logoData: string,
  contentType: string,
  signal?: AbortSignal,
): Promise<ApiResponse<Sponsor>> {
  return putRequest<Sponsor>(
    `/admin/sponsors/${sponsorId}/logo`,
    { logo_data: logoData, content_type: contentType },
    "sponsor logo",
    signal,
  );
}
