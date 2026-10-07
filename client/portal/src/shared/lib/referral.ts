// Influencer referral links: /?s=<code>. The code is saved here when someone
// lands on the login page and sent on their sign-in request, where the backend
// holds it against their email until their account is created.

import { postRequest } from "./api";

export const REFERRAL_PARAM = "s";
// Must match auth.ReferralCodeHeader in the Go backend.
export const REFERRAL_HEADER = "X-Referral-Code";

const STORAGE_KEY = "harp:referral";
const VISIT_KEY_PREFIX = "harp:referral-visit:";
// A link clicked weeks before signing up still counts, but not forever.
const MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000;
// Mirrors referralCodePattern in cmd/api/referrals.go.
const CODE_PATTERN = /^[A-Za-z0-9_-]{3,64}$/;

interface StoredReferral {
  code: string;
  saved_at: number;
}

/** The shareable link for a referral code. */
export function referralLink(
  code: string,
  origin = window.location.origin,
): string {
  return `${origin}/?${REFERRAL_PARAM}=${encodeURIComponent(code)}`;
}

export function isValidReferralCode(code: string): boolean {
  return CODE_PATTERN.test(code);
}

/**
 * Saves a referral code from the landing URL and counts the visit once per
 * tab. The latest link wins, matching the backend. Storage can be blocked
 * (private mode, strict settings), in which case the referral is just lost.
 */
export function captureReferral(code: string | null, now = Date.now()): void {
  if (!code || !isValidReferralCode(code)) return;

  try {
    const stored: StoredReferral = { code, saved_at: now };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(stored));
  } catch {
    // ignore
  }

  let alreadyCounted = false;
  try {
    alreadyCounted = sessionStorage.getItem(VISIT_KEY_PREFIX + code) !== null;
    sessionStorage.setItem(VISIT_KEY_PREFIX + code, "1");
  } catch {
    // ignore: count the visit anyway
  }
  if (!alreadyCounted) {
    void postRequest(
      `/referrals/${encodeURIComponent(code)}/visit`,
      null,
      "referral visit",
    );
  }
}

/** The saved referral code, if one was captured recently enough to count. */
export function getReferralCode(now = Date.now()): string | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const stored = JSON.parse(raw) as Partial<StoredReferral>;
    if (
      typeof stored.code !== "string" ||
      typeof stored.saved_at !== "number" ||
      !isValidReferralCode(stored.code) ||
      now - stored.saved_at > MAX_AGE_MS
    ) {
      localStorage.removeItem(STORAGE_KEY);
      return null;
    }
    return stored.code;
  } catch {
    return null;
  }
}

export function clearReferral(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // ignore
  }
}

/**
 * Forgets the saved code once a request carrying it succeeds. By then the
 * backend holds it against the email (or the account already existed), so
 * keeping it would only credit whoever signs up in this browser next.
 */
export async function clearReferralOnceSent(
  fetchResponse: Response,
): Promise<void> {
  if (!fetchResponse.ok) return;
  try {
    const body = (await fetchResponse.clone().json()) as { status?: string };
    if (body.status === "OK") clearReferral();
  } catch {
    // ignore: not a sign-in response we understand
  }
}

/** Adds the saved referral code to a SuperTokens sign-in request. */
export function withReferralHeader(requestInit: RequestInit): RequestInit {
  const code = getReferralCode();
  if (!code) return requestInit;
  const headers = new Headers(requestInit.headers);
  headers.set(REFERRAL_HEADER, code);
  return { ...requestInit, headers };
}
