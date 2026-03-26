import { patchRequest } from "@/shared/lib/api";
import type { ApiResponse, Application } from "@/types";

export async function setApplicationStatus(
  id: string,
  status: "accepted" | "rejected" | "waitlisted",
): Promise<ApiResponse<{ application: Application }>> {
  return patchRequest<{ application: Application }>(
    `/superadmin/applications/${id}/status`,
    { status },
    "application status",
  );
}
