import { useCallback, useEffect, useState } from "react";

import { useOnboardingStep } from "@/shared/onboarding";
import { useUserStore } from "@/shared/stores";

import { detectPlatform, type InstallPlatform, isStandalone } from "./platform";

// Not yet in lib.dom.d.ts.
interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

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
  const [deferredEvent, setDeferredEvent] =
    useState<BeforeInstallPromptEvent | null>(null);

  // Whether this device can install at all (platform, standalone) is declared
  // in the onboarding registry so the same rule governs whether this step
  // blocks the ones after it.
  const { isActive, settle } = useOnboardingStep("install", !!user);

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

  const promptInstall = useCallback(async () => {
    const event = deferredEvent;
    if (!event) return;
    // The event is single-use, so drop it before awaiting.
    setDeferredEvent(null);
    try {
      await event.prompt();
      await event.userChoice;
    } finally {
      // Settle on either outcome. The browser withholds beforeinstallprompt for
      // a while after a native dismissal, so leaving the step unsettled here
      // would strand every step behind it with no toast left to resolve it.
      settle();
    }
  }, [deferredEvent, settle]);

  return {
    shouldPrompt: isActive,
    platform,
    installed,
    canPromptNatively: !!deferredEvent,
    promptInstall,
    dismiss: settle,
  };
}
