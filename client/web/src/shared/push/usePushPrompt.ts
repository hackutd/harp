import { useCallback, useEffect, useState } from "react";

import { useUserStore } from "@/shared/stores";

import {
  extractKeys,
  getVapidPublicKey,
  isPushSupported,
  subscribePush,
  subscribeToPush,
} from ".";

const PROMPTED_KEY = "push-prompted-v1";
const ENDPOINT_KEY = "push-endpoint-v1";

function isStandalone(): boolean {
  if (typeof window === "undefined") return false;
  if (window.matchMedia("(display-mode: standalone)").matches) return true;
  const nav = navigator as Navigator & { standalone?: boolean };
  return Boolean(nav.standalone);
}

export interface UsePushPromptResult {
  shouldPrompt: boolean;
  accept: () => Promise<void>;
  dismiss: () => void;
}

export function usePushPrompt(): UsePushPromptResult {
  const user = useUserStore((s) => s.user);
  const [installed, setInstalled] = useState(() => isStandalone());
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    function handleInstalled() {
      setInstalled(true);
    }
    window.addEventListener("appinstalled", handleInstalled);
    return () => window.removeEventListener("appinstalled", handleInstalled);
  }, []);

  const shouldPrompt =
    !!user &&
    !dismissed &&
    isPushSupported() &&
    installed &&
    Notification.permission === "default" &&
    localStorage.getItem(PROMPTED_KEY) !== "1";

  const dismiss = useCallback(() => {
    localStorage.setItem(PROMPTED_KEY, "1");
    setDismissed(true);
  }, []);

  const accept = useCallback(async () => {
    try {
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        localStorage.setItem(PROMPTED_KEY, "1");
        setDismissed(true);
        return;
      }

      const keyRes = await getVapidPublicKey();
      if (keyRes.status !== 200 || !keyRes.data) {
        return;
      }

      const subscription = await subscribeToPush(keyRes.data.public_key);
      const { endpoint, p256dh, auth } = extractKeys(subscription);

      const subRes = await subscribePush({
        endpoint,
        p256dh,
        auth,
        user_agent: navigator.userAgent,
      });

      if (subRes.status === 204 || subRes.status === 200) {
        localStorage.setItem(ENDPOINT_KEY, endpoint);
      }
      localStorage.setItem(PROMPTED_KEY, "1");
      setDismissed(true);
    } catch {
      localStorage.setItem(PROMPTED_KEY, "1");
      setDismissed(true);
    }
  }, []);

  return { shouldPrompt, accept, dismiss };
}
