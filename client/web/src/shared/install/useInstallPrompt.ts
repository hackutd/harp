import { useCallback, useEffect, useState } from "react";

import { useUserStore } from "@/shared/stores";

import { detectPlatform, type InstallPlatform, isStandalone } from "./platform";

// Not yet in lib.dom.d.ts.
interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

export const INSTALL_PROMPTED_KEY = "install-prompted-v1";

export interface UseInstallPromptResult {
  shouldPrompt: boolean;
  /** "ios" needs manual instructions; "android" can call promptInstall(). */
  platform: InstallPlatform;
  /** Whether the app is already running installed/standalone. */
  installed: boolean;
  /** True once the browser has offered a native install prompt to trigger. */
  canPromptNatively: boolean;
  promptInstall: () => Promise<void>;
  dismiss: () => void;
}

export function useInstallPrompt(): UseInstallPromptResult {
  const user = useUserStore((s) => s.user);
  const platform = detectPlatform();
  const [installed, setInstalled] = useState(() => isStandalone());
  const [dismissed, setDismissed] = useState(false);
  const [deferredEvent, setDeferredEvent] =
    useState<BeforeInstallPromptEvent | null>(null);

  useEffect(() => {
    function handleBeforeInstallPrompt(event: Event) {
      event.preventDefault();
      setDeferredEvent(event as BeforeInstallPromptEvent);
    }
    function handleInstalled() {
      setInstalled(true);
      setDeferredEvent(null);
    }
    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
    window.addEventListener("appinstalled", handleInstalled);
    return () => {
      window.removeEventListener(
        "beforeinstallprompt",
        handleBeforeInstallPrompt,
      );
      window.removeEventListener("appinstalled", handleInstalled);
    };
  }, []);

  // iOS never fires "appinstalled" — the only signal that a manual install
  // happened is display-mode flipping to standalone, which we can only catch
  // by re-checking when the user comes back to the tab.
  useEffect(() => {
    if (installed || platform !== "ios") return;
    function handleVisibilityChange() {
      if (document.visibilityState === "visible" && isStandalone()) {
        setInstalled(true);
      }
    }
    document.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener("focus", handleVisibilityChange);
    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("focus", handleVisibilityChange);
    };
  }, [installed, platform]);

  const shouldPrompt =
    !!user &&
    !dismissed &&
    !installed &&
    platform !== "desktop" &&
    localStorage.getItem(INSTALL_PROMPTED_KEY) !== "1";

  const dismiss = useCallback(() => {
    localStorage.setItem(INSTALL_PROMPTED_KEY, "1");
    setDismissed(true);
  }, []);

  const promptInstall = useCallback(async () => {
    if (!deferredEvent) return;
    await deferredEvent.prompt();
    const { outcome } = await deferredEvent.userChoice;
    setDeferredEvent(null);
    if (outcome === "accepted") {
      localStorage.setItem(INSTALL_PROMPTED_KEY, "1");
      setDismissed(true);
    }
  }, [deferredEvent]);

  return {
    shouldPrompt,
    platform,
    installed,
    canPromptNatively: !!deferredEvent,
    promptInstall,
    dismiss,
  };
}
