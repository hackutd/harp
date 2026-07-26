import { useCallback, useEffect, useState } from "react";

import { isStandalone } from "@/shared/install/platform";
import { useUserStore } from "@/shared/stores";

import { isPushSupported } from "./client";
import { enablePushSubscription, PUSH_PROMPTED_KEY } from "./subscription";

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

  // iOS never fires "appinstalled" for a manual home-screen add — the only
  // signal is display-mode flipping to standalone, caught when the user
  // returns to the tab (e.g. after using the Share sheet).
  useEffect(() => {
    if (installed) return;
    function recheck() {
      if (isStandalone()) setInstalled(true);
    }
    document.addEventListener("visibilitychange", recheck);
    window.addEventListener("focus", recheck);
    return () => {
      document.removeEventListener("visibilitychange", recheck);
      window.removeEventListener("focus", recheck);
    };
  }, [installed]);

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
