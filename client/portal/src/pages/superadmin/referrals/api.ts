import {
  deleteRequest,
  getRequest,
  postRequest,
  putRequest,
} from "@/shared/lib/api";
import type { ApiResponse } from "@/types";

import type {
  CreateReferralPayload,
  Referral,
  ReferralListResponse,
  ReferralSignupsResponse,
  UpdateReferralPayload,
} from "./types";

export async function fetchReferrals(
  signal?: AbortSignal,
): Promise<ApiResponse<ReferralListResponse>> {
  return getRequest<ReferralListResponse>(
    "/superadmin/referrals",
    "referrals",
    signal,
  );
}

export async function createReferral(
  payload: CreateReferralPayload,
): Promise<ApiResponse<Referral>> {
  return postRequest<Referral>("/superadmin/referrals", payload, "referral");
}

export async function updateReferral(
  id: string,
  payload: UpdateReferralPayload,
): Promise<ApiResponse<Referral>> {
  return putRequest<Referral>(
    `/superadmin/referrals/${id}`,
    payload,
    "referral",
  );
}

export async function deleteReferral(
  id: string,
): Promise<ApiResponse<unknown>> {
  return deleteRequest<unknown>(`/superadmin/referrals/${id}`, "referral");
}

export async function fetchReferralSignups(
  id: string,
  signal?: AbortSignal,
): Promise<ApiResponse<ReferralSignupsResponse>> {
  return getRequest<ReferralSignupsResponse>(
    `/superadmin/referrals/${id}/signups`,
    "referral signups",
    signal,
  );
}
