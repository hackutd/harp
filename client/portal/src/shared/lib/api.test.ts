import { beforeEach, describe, expect, it, vi } from "vitest";

import type { ApiResponse } from "@/types";

import {
  checkEmailAuthMethod,
  deleteRequest,
  errorAlert,
  getRequest,
  patchRequest,
  postRequest,
  putRequest,
} from "./api";

const toast = vi.hoisted(() => ({ error: vi.fn() }));
vi.mock("sonner", () => ({ toast }));

// The config's unstubGlobals restores the real fetch after every test.
let fetchMock: ReturnType<typeof vi.fn>;

beforeEach(() => {
  fetchMock = vi.fn();
  vi.stubGlobal("fetch", fetchMock);
});

function okResponse(data: unknown, status = 200): Response {
  return new Response(JSON.stringify({ data }), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function errorResponse(
  error: string | null,
  status = 400,
  extra: Record<string, unknown> = {},
): Response {
  return new Response(JSON.stringify(error ? { error, ...extra } : extra), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

type HttpMethod = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";

/** Calls each exported request helper the same way, with an optional body. */
const send: Record<
  HttpMethod,
  (endpoint: string, body?: unknown) => Promise<ApiResponse<unknown>>
> = {
  GET: (endpoint) => getRequest(endpoint),
  POST: (endpoint, body) => postRequest(endpoint, body),
  PUT: (endpoint, body) => putRequest(endpoint, body),
  PATCH: (endpoint, body) => patchRequest(endpoint, body),
  DELETE: (endpoint) => deleteRequest(endpoint),
};

function lastInit(): RequestInit {
  return fetchMock.mock.calls[0][1] as RequestInit;
}

describe("request method plumbing against mocked fetch", () => {
  it.each<[HttpMethod, unknown]>([
    ["GET", undefined],
    ["POST", { title: "Hi" }],
    ["PUT", { id: 1 }],
    ["PATCH", { active: true }],
    ["DELETE", undefined],
  ])(
    "%s issues the correct method/url/credentials/headers/body",
    async (method, body) => {
      fetchMock.mockResolvedValue(okResponse(null));

      await send[method]("/things", body);

      expect(String(fetchMock.mock.calls[0][0])).toBe("/v1/things");
      const init = lastInit();
      expect(init.method).toBe(method);
      expect(init.credentials).toBe("include");
      expect(init.headers).toMatchObject({
        "Content-Type": "application/json",
      });
      if (body === undefined) {
        expect(init.body).toBeUndefined();
      } else {
        expect(JSON.parse(init.body as string)).toEqual(body);
      }
    },
  );
});

describe("success envelopes map to typed data", () => {
  it("returns data from a successful GET", async () => {
    fetchMock.mockResolvedValue(okResponse({ id: 7 }));
    const res = await getRequest<{ id: number }>("/things");
    expect(res.status).toBe(200);
    expect(res.data).toEqual({ id: 7 });
    expect(res.error).toBeUndefined();
  });

  it("returns data from a successful POST and serializes the body", async () => {
    fetchMock.mockResolvedValue(okResponse({ ok: true }));
    const res = await postRequest<{ ok: boolean }>("/things", { a: 1 });
    expect(res.status).toBe(200);
    expect(res.data).toEqual({ ok: true });
    const [, init] = fetchMock.mock.calls[0];
    expect(JSON.parse((init as RequestInit).body as string)).toEqual({ a: 1 });
  });
});

describe("API error envelopes and fallbacks surface consistently", () => {
  it.each<[HttpMethod, string]>([
    ["GET", "Failed to fetch /things"],
    ["POST", "Failed to post /things"],
    ["PUT", "Failed to update /things"],
    ["PATCH", "Failed to update /things"],
    ["DELETE", "Failed to delete /things"],
  ])(
    "%s falls back to the endpoint when the envelope is empty",
    async (method, expected) => {
      fetchMock.mockResolvedValue(errorResponse(null, 500));

      const res = await send[method]("/things", {});

      expect(res.status).toBe(500);
      expect(res.data).toBeUndefined();
      expect(res.error).toBe(expected);
    },
  );

  it("names the error context instead of the endpoint when one is given", async () => {
    fetchMock.mockResolvedValue(errorResponse(null, 500));
    const res = await getRequest("/things", "sponsor list");
    expect(res.error).toBe("Failed to fetch sponsor list");
  });

  it("passes field-level validation errors through", async () => {
    const fields = ["email"];
    fetchMock.mockResolvedValue(errorResponse("Invalid", 422, { fields }));
    const res = await postRequest("/things", {});
    expect(res.fields).toEqual(fields);
  });

  it("ignores a fields value that is not an array", async () => {
    fetchMock.mockResolvedValue(
      errorResponse("Invalid", 422, { fields: "email" }),
    );
    const res = await postRequest("/things", {});
    expect(res.fields).toBeUndefined();
  });

  it("surfaces the server-provided error message from the envelope", async () => {
    fetchMock.mockResolvedValue(errorResponse("Server said no", 422));
    const res = await postRequest("/things", {});
    expect(res.status).toBe(422);
    expect(res.error).toBe("Server said no");
  });
});

describe("malformed JSON, network failures, and aborts", () => {
  it("treats malformed JSON as an absent envelope without throwing", async () => {
    fetchMock.mockResolvedValue(
      new Response("<html>not json</html>", { status: 200 }),
    );
    const res = await getRequest("/things");
    expect(res.status).toBe(200);
    expect(res.data).toBeUndefined();
  });

  it("maps a network failure to a 500 with the error message", async () => {
    fetchMock.mockRejectedValue(new Error("Failed to fetch"));
    const res = await getRequest("/things");
    expect(res.status).toBe(500);
    expect(res.error).toBe("Failed to fetch");
  });

  it("maps an aborted request to a Request aborted envelope", async () => {
    fetchMock.mockRejectedValue(new DOMException("Aborted", "AbortError"));
    const res = await getRequest("/things");
    expect(res.status).toBe(0);
    expect(res.error).toBe("Request aborted");
  });
});

describe("checkEmailAuthMethod", () => {
  it("GETs the encoded email check endpoint", async () => {
    fetchMock.mockResolvedValue(
      okResponse({ exists: true, auth_method: "google" }),
    );
    const res = await checkEmailAuthMethod("ada+tag@example.com");
    const [input, init] = fetchMock.mock.calls[0];
    expect(String(input)).toContain("/v1/auth/check-email");
    expect(String(input)).toContain(encodeURIComponent("ada+tag@example.com"));
    expect((init as RequestInit).method).toBe("GET");
    expect(res.data).toEqual({ exists: true, auth_method: "google" });
  });
});

describe("errorAlert", () => {
  it.each([
    [
      "the custom message first",
      { status: 500, error: "server" },
      "custom",
      "custom",
    ],
    [
      "the response error next",
      { status: 500, error: "server" },
      undefined,
      "server",
    ],
    [
      "a generic fallback last",
      { status: 500 },
      undefined,
      "An unexpected error occurred",
    ],
  ])("toasts %s", (_label, res, custom, expected) => {
    errorAlert(res, custom);
    expect(toast.error).toHaveBeenCalledWith(expected);
  });
});
