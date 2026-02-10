// Centralized API client - all HTTP requests go through here

import { toast } from "sonner";

import type { ApiResponse } from "@/types";

const API_VERSION = "/v1";

function buildUrl(endpoint: string): string {
  if (endpoint.startsWith("/auth")) return endpoint;
  return `${API_VERSION}${endpoint}`;
}

/**
 * Generic GET request
 */
export async function getRequest<T>(
  endpoint: string,
  errorContext?: string,
  signal?: AbortSignal
): Promise<ApiResponse<T>> {
  try {
    const response = await fetch(`${buildUrl(endpoint)}`, {
      method: "GET",
      credentials: "include", // cookies for SuperTokens session
      headers: {
        "Content-Type": "application/json",
      },
      signal,
    });

    const json = await response.json().catch(() => null);

    return {
      status: response.status,
      data: response.ok ? json?.data : undefined,
      error: !response.ok
        ? json?.error || `Failed to fetch ${errorContext || endpoint}`
        : undefined,
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

/**
 * Generic POST request
 */
export async function postRequest<T>(
  endpoint: string,
  body: unknown,
  errorContext?: string,
  signal?: AbortSignal
): Promise<ApiResponse<T>> {
  try {
    const response = await fetch(`${buildUrl(endpoint)}`, {
      method: "POST",
      credentials: "include",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
      signal,
    });

    const json = await response.json().catch(() => null);

    return {
      status: response.status,
      data: response.ok ? json?.data : undefined,
      error: !response.ok
        ? json?.error || `Failed to post ${errorContext || endpoint}`
        : undefined,
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

/**
 * Generic PUT request
 */
export async function putRequest<T>(
  endpoint: string,
  body: unknown,
  errorContext?: string,
  signal?: AbortSignal
): Promise<ApiResponse<T>> {
  try {
    const response = await fetch(`${buildUrl(endpoint)}`, {
      method: "PUT",
      credentials: "include",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
      signal,
    });

    const json = await response.json().catch(() => null);

    return {
      status: response.status,
      data: response.ok ? json?.data : undefined,
      error: !response.ok
        ? json?.error || `Failed to update ${errorContext || endpoint}`
        : undefined,
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

/**
 * Generic PATCH request
 */
export async function patchRequest<T>(
  endpoint: string,
  body: unknown,
  errorContext?: string,
  signal?: AbortSignal
): Promise<ApiResponse<T>> {
  try {
    const response = await fetch(`${buildUrl(endpoint)}`, {
      method: "PATCH",
      credentials: "include",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
      signal,
    });

    const json = await response.json().catch(() => null);

    return {
      status: response.status,
      data: response.ok ? json : undefined,
      error: !response.ok
        ? json?.error || `Failed to update ${errorContext || endpoint}`
        : undefined,
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

/**
 * Generic DELETE request
 */
export async function deleteRequest<T>(
  endpoint: string,
  errorContext?: string,
  signal?: AbortSignal
): Promise<ApiResponse<T>> {
  try {
    const response = await fetch(`${buildUrl(endpoint)}`, {
      method: "DELETE",
      credentials: "include",
      headers: {
        "Content-Type": "application/json",
      },
      signal,
    });

    const json = await response.json().catch(() => null);

    return {
      status: response.status,
      data: response.ok ? json?.data : undefined,
      error: !response.ok
        ? json?.error || `Failed to delete ${errorContext || endpoint}`
        : undefined,
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

/**
 * Display error toast to user
 */
export function errorAlert(res: ApiResponse, customMessage?: string): void {
  const message = customMessage || res.error || "An unexpected error occurred";
  toast.error(message);
}

/**
 * Response type for email auth method check
 */
export interface CheckEmailResponse {
  exists: boolean;
  auth_method?: "passwordless" | "google";
}

/**
 * Check if an email exists and get its auth method
 */
export async function checkEmailAuthMethod(
  email: string
): Promise<ApiResponse<CheckEmailResponse>> {
  return getRequest<CheckEmailResponse>(
    `/auth/check-email?email=${encodeURIComponent(email)}`,
    "email check"
  );
}
