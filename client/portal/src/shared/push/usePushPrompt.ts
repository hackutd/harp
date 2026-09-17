import { useCallback } from "react";

import { useOnboardingStep } from "@/shared/onboarding";
import { useUserStore } from "@/shared/stores";

import { enablePushSubscription } from "./subscription";

export interface UsePushPromptResult {
  shouldPrompt: boolean;
  accept: () => Promise<void>;
  dismiss: () => void;
}

export function usePushPrompt(): UsePushPromptResult {
  const user = useUserStore((s) => s.user);
  // Push support, the standalone requirement (iOS 16.4+ only exposes web push
  // to home-screen apps) and "permission still unanswered" are all declared in
  // the onboarding registry, which also re-checks them when the display mode
  // flips — so this step no longer tracks install state itself.
  const { isActive, settle } = useOnboardingStep("push", !!user);

  const accept = useCallback(async () => {
    try {
      await enablePushSubscription();
    } finally {
      // Granted, denied or errored — the user has been asked once.
      settle();
    }
  }, [settle]);

  return { shouldPrompt: isActive, accept, dismiss: settle };
}
