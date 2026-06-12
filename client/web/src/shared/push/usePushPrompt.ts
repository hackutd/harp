import { useCallback, useEffect, useState } from "react";

import { useUserStore } from "@/shared/stores";

import { isPushSupported } from "./client";
import { enablePushSubscription, PUSH_PROMPTED_KEY } from "./subscription";

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
    localStorage.getItem(PUSH_PROMPTED_KEY) !== "1";

  const dismiss = useCallback(() => {
    localStorage.setItem(PUSH_PROMPTED_KEY, "1");
    setDismissed(true);
  }, []);

  const accept = useCallback(async () => {
    try {
      await enablePushSubscription();
    } finally {
      localStorage.setItem(PUSH_PROMPTED_KEY, "1");
      setDismissed(true);
    }
  }, []);

  return { shouldPrompt, accept, dismiss };
}
