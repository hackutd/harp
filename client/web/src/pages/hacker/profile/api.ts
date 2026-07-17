import { deleteRequest } from "@/shared/lib/api";
import type { ApiResponse } from "@/types";

export async function deleteMyAccount(): Promise<ApiResponse<void>> {
  return deleteRequest<void>("/users/me", "account");
}
