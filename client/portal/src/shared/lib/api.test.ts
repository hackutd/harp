import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  checkEmailAuthMethod,
  deleteRequest,
  getRequest,
  patchRequest,
  postRequest,
  putRequest,
} from "./api";

let fetchMock: ReturnType<typeof vi.fn>;

beforeEach(() => {
  fetchMock = vi.fn();
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  // Reset module-level sequencing between tests so stale request state leaks.
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

function okResponse(data: unknown, status = 200): Response {
  return new Response(JSON.stringify({ data }), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function errorResponse(error: string | null, status = 400): Response {
  return new Response(JSON.stringify(error ? { error } : {}), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

/** Maps a method name to its exported request factory. */
function requestFor(
  method: string,
): (
  endpoint: string,
  bodyOrErrorContext?: unknown | string,
  maybeErrorContext?: string,
  maybeSignal?: AbortSignal,
) => Promise<{ status: number }> {
  switch (method) {
    case "GET":
      return (endpoint: string, errorContext?: string, signal?: AbortSignal) =>
        getRequest(endpoint, errorContext ?? "", signal);
    case "POST":
      return (
        endpoint: string,
        bodyOrErrorContext?: unknown,
        errorContext?: string,
        signal?: AbortSignal,
      ) =>
        postRequest(endpoint, bodyOrErrorContext, errorContext ?? "", signal);
    case "PUT":
      return (
        endpoint: string,
        bodyOrErrorContext?: unknown,
        errorContext?: string,
        signal?: AbortSignal,
      ) => putRequest(endpoint, bodyOrErrorContext, errorContext ?? "", signal);
    case "PATCH":
      return (
        endpoint: string,
        bodyOrErrorContext?: unknown,
        errorContext?: string,
        signal?: AbortSignal,
      ) =>
        patchRequest(endpoint, bodyOrErrorContext, errorContext ?? "", signal);
    default:
      return (endpoint: string, errorContext?: string, signal?: AbortSignal) =>
        deleteRequest(endpoint, errorContext ?? "", signal);
  }
}

describe("request method plumbing against mocked fetch", () => {
  it.each([
    ["GET", undefined],
    ["POST", { title: "Hi" }],
    ["PUT", { id: 1 }],
    ["PATCH", { active: true }],
    ["DELETE", undefined],
  ])(
    "%s issues the correct method/url/credentials/headers/body",
    async (method, body) => {
      fetchMock.mockResolvedValue(okResponse(null));
      await requestFor(method)("/things", body);

      const [input, init] = fetchMock.mock.calls[0];
      expect(String(input).startsWith("/v1/things")).toBe(true);
      expect((init as RequestInit).method).toBe(method);
      expect((init as RequestInit).credentials).toBe("include");
      expect((init as RequestInit).headers).toMatchObject({
        "Content-Type": "application/json",
      });
      if (method === "GET" || method === "DELETE") {
        expect((init as RequestInit).body).toBeUndefined();
      } else {
        expect(JSON.parse((init as RequestInit).body as string)).toEqual(body);
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
  it.each([
    ["GET", "/things", "Failed to fetch /things"],
    ["POST", "/things", "Failed to post /things"],
    ["PUT", "/things", "Failed to update /things"],
    ["PATCH", "/things", "Failed to update /things"],
    ["DELETE", "/things", "Failed to delete /things"],
  ])(
    "%s falls back to the context message when the envelope is empty",
    async (method, endpoint, expected) => {
      fetchMock.mockResolvedValue(errorResponse(null, 500));
      const res = (await requestFor(method)(endpoint)) as {
        status: number;
        data?: unknown;
        error?: string;
      };
      expect(res.status).toBe(500);
      expect(res.data).toBeUndefined();
      expect(res.error).toBe(expected);
    },
  );

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
    const controller = new AbortController();
    const res = await getRequest("/things", "ctx", controller.signal);
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
