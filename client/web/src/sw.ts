/// <reference lib="webworker" />
import { precacheAndRoute } from "workbox-precaching";

declare const self: ServiceWorkerGlobalScope;

self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

precacheAndRoute(self.__WB_MANIFEST);

interface PushPayload {
  id?: string;
  title?: string;
  body?: string;
  url?: string;
}

const DEFAULT_NOTIFICATION_URL = "/app";

function resolveSameOriginNotificationUrl(value?: string): string {
  if (!value) return DEFAULT_NOTIFICATION_URL;

  try {
    const resolved = new URL(value, self.location.origin);
    if (resolved.origin !== self.location.origin) {
      return DEFAULT_NOTIFICATION_URL;
    }

    return `${resolved.pathname}${resolved.search}${resolved.hash}`;
  } catch {
    return DEFAULT_NOTIFICATION_URL;
  }
}

self.addEventListener("push", (event) => {
  let data: PushPayload = {};
  if (event.data) {
    try {
      data = event.data.json() as PushPayload;
    } catch {
      data = { body: event.data.text() };
    }
  }

  const title = data.title ?? "HARP";
  const options: NotificationOptions = {
    body: data.body ?? "",
    data: { url: resolveSameOriginNotificationUrl(data.url), id: data.id },
    icon: "/pwa-192x192.png",
    badge: "/pwa-192x192.png",
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const data = event.notification.data as { url?: string } | undefined;
  const url = resolveSameOriginNotificationUrl(data?.url);

  event.waitUntil(
    (async () => {
      const allClients = await self.clients.matchAll({
        type: "window",
        includeUncontrolled: true,
      });

      for (const client of allClients) {
        if ("focus" in client) {
          await (client as WindowClient).navigate(url).catch(() => undefined);
          return (client as WindowClient).focus();
        }
      }

      return self.clients.openWindow(url);
    })(),
  );
});
