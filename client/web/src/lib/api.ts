// Centralized API client - all HTTP requests go through here

import { toast } from "sonner";
import type { ApiResponse } from "../types";

const API_BASE_URL = import.meta.env.VITE_API_URL || "";

/**
 * Generic GET request
 */
export async function getRequest<T>(
  endpoint: string,
  errorContext?: string
): Promise<ApiResponse<T>> {
  try {
    const response = await fetch(`${API_BASE_URL}${endpoint}`, {
      method: "GET",
      credentials: "include", // Include cookies for SuperTokens session
      headers: {
        "Content-Type": "application/json",
      },
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
  errorContext?: string
): Promise<ApiResponse<T>> {
  try {
    const response = await fetch(`${API_BASE_URL}${endpoint}`, {
      method: "POST",
      credentials: "include",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
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
  errorContext?: string
): Promise<ApiResponse<T>> {
  try {
    const response = await fetch(`${API_BASE_URL}${endpoint}`, {
      method: "PUT",
      credentials: "include",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
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
  errorContext?: string
): Promise<ApiResponse<T>> {
  try {
    const response = await fetch(`${API_BASE_URL}${endpoint}`, {
      method: "PATCH",
      credentials: "include",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
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
  errorContext?: string
): Promise<ApiResponse<T>> {
  try {
    const response = await fetch(`${API_BASE_URL}${endpoint}`, {
      method: "DELETE",
      credentials: "include",
      headers: {
        "Content-Type": "application/json",
      },
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
