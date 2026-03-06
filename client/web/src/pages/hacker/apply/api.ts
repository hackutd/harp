import { deleteRequest, patchRequest, postRequest } from "@/shared/lib/api";
import type { ApiResponse, Application } from "@/types";

const MAX_RESUME_SIZE_BYTES = 5 * 1024 * 1024;
const UPLOAD_SIZE_RANGE_HEADER = `0,${MAX_RESUME_SIZE_BYTES}`;

interface DataEnvelope<T> {
  data: T;
}

export interface ResumeUploadURLResponse {
  upload_url: string;
  resume_path: string;
}

function unwrapPatchedApplication(
  data: Application | DataEnvelope<Application> | undefined,
): Application | undefined {
  if (!data) return undefined;
  if ("data" in data) {
    return data.data;
  }
  return data;
}

export async function updateMyApplication(
  payload: Record<string, unknown>,
): Promise<ApiResponse<Application>> {
  const res = await patchRequest<Application | DataEnvelope<Application>>(
    "/applications/me",
    payload,
    "application",
  );

  if (res.status !== 200) {
    return { status: res.status, error: res.error };
  }

  const application = unwrapPatchedApplication(res.data);
  if (!application) {
    return {
      status: 500,
      error: "Failed to parse application response",
    };
  }

  return { status: 200, data: application };
}

export async function requestResumeUploadURL(): Promise<
  ApiResponse<ResumeUploadURLResponse>
> {
  return postRequest<ResumeUploadURLResponse>(
    "/applications/me/resume-upload-url",
    {},
    "resume upload url",
  );
}

export async function deleteMyResume(): Promise<ApiResponse<Application>> {
  return deleteRequest<Application>("/applications/me/resume", "resume");
}

export async function uploadResumeToSignedURL(
  uploadURL: string,
  file: File,
): Promise<{ status: number; error?: string }> {
  try {
    const response = await fetch(uploadURL, {
      method: "PUT",
      headers: {
        "Content-Type": "application/pdf",
        "x-goog-content-length-range": UPLOAD_SIZE_RANGE_HEADER,
      },
      body: file,
    });

    if (!response.ok) {
      const message = await response.text().catch(() => "");
      return {
        status: response.status,
        error: message || `Resume upload failed with status ${response.status}`,
      };
    }

    return { status: response.status };
  } catch (error) {
    return {
      status: 500,
      error: error instanceof Error ? error.message : "Network error",
    };
  }
}

export { MAX_RESUME_SIZE_BYTES };

// University Search API (Hipo)
export interface University {
  name: string;
  country: string;
  alpha_two_code: string;
  domains: string[];
  web_pages: string[];
  state_province: string | null;
}

const HIPO_API_BASE = "http://universities.hipolabs.com";
const universityCache = new Map<string, University[]>();

//Search universities via Hipo API
export async function searchUniversities(query: string): Promise<University[]> {
  if (query.length < 2) return [];

  const cacheKey = query.toLowerCase();
  if (universityCache.has(cacheKey)) {
    return universityCache.get(cacheKey)!;
  }

  try {
    const params = new URLSearchParams({ name: query });
    const response = await fetch(`${HIPO_API_BASE}/search?${params}`);

    if (!response.ok) return [];

    const universities: University[] = await response.json();

    // Cache results (limit cache size)
    if (universityCache.size > 100) {
      const firstKey = universityCache.keys().next().value;
      if (firstKey) universityCache.delete(firstKey);
    }
    universityCache.set(cacheKey, universities);

    return universities;
  } catch {
    return [];
  }
}

export const POPULAR_UNIVERSITIES = [
  "University of Texas at Dallas",
  "University of Texas at Austin",
  "Texas A&M University",
  "Massachusetts Institute of Technology",
  "Stanford University",
  "Harvard University",
];
