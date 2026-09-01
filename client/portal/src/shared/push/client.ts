// Web Push browser client helpers — converts VAPID keys, manages subscriptions.

export function urlBase64ToUint8Array(base64: string): Uint8Array {
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);
  const normalized = (base64 + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(normalized);
  const array = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) {
    array[i] = raw.charCodeAt(i);
  }
  return array;
}

export function isPushSupported(): boolean {
  return (
    "serviceWorker" in navigator &&
    "PushManager" in window &&
    "Notification" in window
  );
}

export async function getCurrentSubscription(): Promise<PushSubscription | null> {
  if (!isPushSupported()) return null;
  const reg = await navigator.serviceWorker.ready;
  return reg.pushManager.getSubscription();
}

function applicationServerKeyMatches(
  existing: ArrayBuffer | null,
  desired: Uint8Array,
): boolean {
  if (!existing) return false; // unreadable -> caller decides (treated as "keep")
  const current = new Uint8Array(existing);
  if (current.length !== desired.length) return false;
  for (let i = 0; i < current.length; i++) {
    if (current[i] !== desired[i]) return false;
  }
  return true;
}

export async function subscribeToPush(
  vapidPublicKey: string,
): Promise<PushSubscription> {
  const reg = await navigator.serviceWorker.ready;
  const applicationServerKey = urlBase64ToUint8Array(vapidPublicKey);

  const existing = await reg.pushManager.getSubscription();
  if (existing) {
    const existingKey = existing.options.applicationServerKey;
    // Keep the subscription if it matches the current key, OR if the browser
    // doesn't expose the key (e.g. Safari returns null) — avoids needless
    // endpoint churn. Only rotate when we can prove the key changed.
    if (
      existingKey === null ||
      applicationServerKeyMatches(existingKey, applicationServerKey)
    ) {
      return existing;
    }
    await existing.unsubscribe();
  }

  return reg.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: applicationServerKey as BufferSource,
  });
}

export async function unsubscribeFromPush(): Promise<string | null> {
  if (!isPushSupported()) return null;
  const reg = await navigator.serviceWorker.ready;
  const sub = await reg.pushManager.getSubscription();
  if (!sub) return null;
  const endpoint = sub.endpoint;
  await sub.unsubscribe();
  return endpoint;
}

export function extractKeys(subscription: PushSubscription): {
  endpoint: string;
  p256dh: string;
  auth: string;
} {
  const json = subscription.toJSON();
  const keys = json.keys ?? {};
  return {
    endpoint: subscription.endpoint,
    p256dh: keys.p256dh ?? "",
    auth: keys.auth ?? "",
  };
}
