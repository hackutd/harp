import { getRequest } from "@/shared/lib/api";
import type { ApiResponse } from "@/types";

import type { FAQListResponse } from "./types";

export async function fetchFAQ(
  signal?: AbortSignal,
): Promise<ApiResponse<FAQListResponse>> {
  return getRequest<FAQListResponse>("/faq", "faq", signal);
}
