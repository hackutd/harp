import { getRequest, postRequest } from "@/shared/lib/api";
import type { ApiResponse } from "@/types";

export interface VapidPublicKeyResponse {
  public_key: string;
}

export interface SubscribePushPayload {
  endpoint: string;
  p256dh: string;
  auth: string;
  user_agent?: string;
}

export async function getVapidPublicKey(
  signal?: AbortSignal,
): Promise<ApiResponse<VapidPublicKeyResponse>> {
  return getRequest<VapidPublicKeyResponse>(
    "/notifications/vapid-public-key",
    "VAPID public key",
    signal,
  );
}

export async function subscribePush(
  payload: SubscribePushPayload,
  signal?: AbortSignal,
): Promise<ApiResponse<unknown>> {
  return postRequest<unknown>(
    "/notifications/subscribe",
    payload,
    "push subscription",
    signal,
  );
}

export async function unsubscribePush(
  endpoint: string,
  signal?: AbortSignal,
): Promise<ApiResponse<unknown>> {
  // deleteRequest doesn't take a body, so use fetch directly for the rare DELETE-with-body case.
  try {
    const response = await fetch(`/v1/notifications/subscribe`, {
      method: "DELETE",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ endpoint }),
      signal,
    });
    return {
      status: response.status,
      error: response.ok
        ? undefined
        : `Failed to unsubscribe (status ${response.status})`,
    };
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") {
      return { status: 0, error: "Request aborted" };
    }
    return {
      status: 500,
      error: error instanceof Error ? error.message : "Network error",
    };
  }
}
