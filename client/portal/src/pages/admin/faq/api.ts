import {
  deleteRequest,
  getRequest,
  postRequest,
  putRequest,
} from "@/shared/lib/api";
import type { ApiResponse } from "@/types";

import type { FAQ, FAQListResponse, FAQPayload } from "./types";

export async function fetchFAQs(
  signal?: AbortSignal,
): Promise<ApiResponse<FAQListResponse>> {
  return getRequest<FAQListResponse>("/admin/faq", "FAQs", signal);
}

export async function fetchFAQEditPermission(
  signal?: AbortSignal,
): Promise<ApiResponse<{ enabled: boolean }>> {
  return getRequest<{ enabled: boolean }>(
    "/admin/faq/edit-permission",
    "FAQ edit permission",
    signal,
  );
}

export async function createFAQ(
  payload: FAQPayload,
  signal?: AbortSignal,
): Promise<ApiResponse<FAQ>> {
  return postRequest<FAQ>("/admin/faq", payload, "FAQ", signal);
}

export async function updateFAQ(
  id: string,
  payload: FAQPayload,
  signal?: AbortSignal,
): Promise<ApiResponse<FAQ>> {
  return putRequest<FAQ>(`/admin/faq/${id}`, payload, "FAQ", signal);
}

export async function deleteFAQ(
  id: string,
  signal?: AbortSignal,
): Promise<ApiResponse<unknown>> {
  return deleteRequest<unknown>(`/admin/faq/${id}`, "FAQ", signal);
}
