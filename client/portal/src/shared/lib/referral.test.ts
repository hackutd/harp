import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  captureReferral,
  clearReferralOnSignIn,
  getReferralCode,
  isValidReferralCode,
  REFERRAL_HEADER,
  referralLink,
  withReferralHeader,
} from "./referral";

const api = vi.hoisted(() => ({ postRequest: vi.fn() }));
vi.mock("./api", () => ({ postRequest: api.postRequest }));

const DAY = 24 * 60 * 60 * 1000;

// In-memory Web Storage. Recent Node versions ship their own localStorage
// global that shadows jsdom's and is unusable without a backing file.
class MemoryStorage implements Storage {
  private items = new Map<string, string>();
  get length() {
    return this.items.size;
  }
  clear() {
    this.items.clear();
  }
  getItem(key: string) {
    return this.items.get(key) ?? null;
  }
  key(index: number) {
    return [...this.items.keys()][index] ?? null;
  }
  removeItem(key: string) {
    this.items.delete(key);
  }
  setItem(key: string, value: string) {
    this.items.set(key, String(value));
  }
}

beforeEach(() => {
  vi.stubGlobal("localStorage", new MemoryStorage());
  vi.stubGlobal("sessionStorage", new MemoryStorage());
  api.postRequest.mockResolvedValue({ status: 204 });
});

describe("isValidReferralCode", () => {
  it.each([
    ["NbjlBgit", true],
    ["kai-codes_2026", true],
    ["abc", true],
    ["ab", false],
    ["a".repeat(65), false],
    ["kai codes", false],
    ["kai&codes", false],
    ["", false],
  ])("%s -> %s", (code, valid) => {
    expect(isValidReferralCode(code)).toBe(valid);
  });
});

describe("captureReferral", () => {
  it("saves the code and counts one visit per tab", () => {
    captureReferral("NbjlBgit");
    captureReferral("NbjlBgit");

    expect(getReferralCode()).toBe("NbjlBgit");
    expect(api.postRequest).toHaveBeenCalledTimes(1);
    expect(api.postRequest).toHaveBeenCalledWith(
      "/referrals/NbjlBgit/visit",
      null,
      "referral visit",
    );
  });

  it("lets the latest link win", () => {
    captureReferral("first01");
    captureReferral("second02");

    expect(getReferralCode()).toBe("second02");
    expect(api.postRequest).toHaveBeenCalledTimes(2);
  });

  it.each([null, "", "no spaces", "x"])("ignores %j", (code) => {
    captureReferral(code);

    expect(getReferralCode()).toBeNull();
    expect(api.postRequest).not.toHaveBeenCalled();
  });
});

describe("getReferralCode", () => {
  it("expires a code after 30 days", () => {
    const now = Date.now();
    captureReferral("NbjlBgit", now - 31 * DAY);

    expect(getReferralCode(now)).toBeNull();
    expect(localStorage.length).toBe(0);
  });

  it("keeps a code within 30 days", () => {
    const now = Date.now();
    captureReferral("NbjlBgit", now - 29 * DAY);

    expect(getReferralCode(now)).toBe("NbjlBgit");
  });

  it("drops a corrupt entry", () => {
    localStorage.setItem("harp:referral", "{not json");

    expect(getReferralCode()).toBeNull();
  });
});

describe("withReferralHeader", () => {
  it("adds the saved code and keeps existing headers", () => {
    captureReferral("NbjlBgit");

    const init = withReferralHeader({
      method: "POST",
      headers: { "Content-Type": "application/json" },
    });
    const headers = new Headers(init.headers);

    expect(init.method).toBe("POST");
    expect(headers.get(REFERRAL_HEADER)).toBe("NbjlBgit");
    expect(headers.get("Content-Type")).toBe("application/json");
  });

  it("leaves the request alone without a saved code", () => {
    const init: RequestInit = { method: "POST" };

    expect(withReferralHeader(init)).toBe(init);
  });
});

describe("clearReferralOnSignIn", () => {
  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), { status });

  it("forgets the code after a successful sign-in", async () => {
    captureReferral("NbjlBgit");

    await clearReferralOnSignIn(json({ status: "OK" }));

    expect(getReferralCode()).toBeNull();
  });

  it.each([
    ["a failed code", json({ status: "INCORRECT_USER_INPUT_CODE_ERROR" })],
    ["an HTTP error", json({ status: "OK" }, 500)],
    ["a non-JSON body", new Response("nope")],
  ])("keeps the code after %s", async (_, response) => {
    captureReferral("NbjlBgit");

    await clearReferralOnSignIn(response);

    expect(getReferralCode()).toBe("NbjlBgit");
  });
});

describe("referralLink", () => {
  it("builds a link to the sign-in page", () => {
    expect(referralLink("NbjlBgit", "https://harp.hackutd.co")).toBe(
      "https://harp.hackutd.co/?s=NbjlBgit",
    );
  });
});
