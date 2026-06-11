// Shared subscribe/unsubscribe flow used by both the one-time prompt and the
// always-available toggle. Import from ./api and ./client directly (not the
// barrel) to avoid a circular import with index.ts.

import { getVapidPublicKey, subscribePush, unsubscribePush } from "./api";
import {
  extractKeys,
  getCurrentSubscription,
  subscribeToPush,
  unsubscribeFromPush,
} from "./client";

// localStorage keys shared across the push module.
export const PUSH_PROMPTED_KEY = "push-prompted-v1";
export const PUSH_ENDPOINT_KEY = "push-endpoint-v1";

export type EnablePushResult = "granted" | "denied" | "error";

// Requests permission, creates a browser push subscription, and registers it
// with the backend. Returns the outcome so callers can surface feedback.
export async function enablePushSubscription(): Promise<EnablePushResult> {
  const permission = await Notification.requestPermission();
  if (permission !== "granted") {
    return "denied";
  }

  const keyRes = await getVapidPublicKey();
  if (keyRes.status !== 200 || !keyRes.data) {
    return "error";
  }

  const subscription = await subscribeToPush(keyRes.data.public_key);
  const { endpoint, p256dh, auth } = extractKeys(subscription);

  const subRes = await subscribePush({
    endpoint,
    p256dh,
    auth,
    user_agent: navigator.userAgent,
  });

  if (subRes.status !== 204 && subRes.status !== 200) {
    return "error";
  }

  localStorage.setItem(PUSH_ENDPOINT_KEY, endpoint);
  return "granted";
}

// Removes the backend registration and tears down the browser subscription.
export async function disablePushSubscription(): Promise<void> {
  const sub = await getCurrentSubscription();
  const endpoint = sub?.endpoint ?? localStorage.getItem(PUSH_ENDPOINT_KEY);

  if (endpoint) {
    await unsubscribePush(endpoint);
  }
  await unsubscribeFromPush();
  localStorage.removeItem(PUSH_ENDPOINT_KEY);
}
