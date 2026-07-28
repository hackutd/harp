import { getRequest } from "@/shared/lib/api";
import type { ApiResponse } from "@/types";

import type { HackerPackURLResponse } from "./types";

export async function fetchHackerPackURL(
  signal?: AbortSignal,
): Promise<ApiResponse<HackerPackURLResponse>> {
  return getRequest<HackerPackURLResponse>(
    "/hacker-pack",
    "hacker pack",
    signal,
  );
}
