import type { ApiResponse } from "@/types";
import { getRequest, postRequest } from "@/shared/lib/api";

import type { PromoteResponse, WalkInsResponse } from "./types";

export function getWalkInQueue(
  signal?: AbortSignal,
): Promise<ApiResponse<WalkInsResponse>> {
  return getRequest<WalkInsResponse>(
    "/superadmin/walk-ins",
    "fetch walk-in queue",
    signal,
  );
}

export function promoteWalkIns(
  count: number,
): Promise<ApiResponse<PromoteResponse>> {
  return postRequest<PromoteResponse>(
    "/superadmin/walk-ins/promote",
    { count },
    "promote walk-ins",
  );
}
