import { useCallback, useEffect, useState } from "react";

import { isPushSupported } from "@/shared/push/client";
import {
  PUSH_PROMPT_SETTLED_EVENT,
  PUSH_PROMPTED_KEY,
} from "@/shared/push/subscription";
import { useUserStore } from "@/shared/stores";

export const SCHEDULE_TIP_PROMPTED_KEY = "schedule-tip-prompted-v1";

export interface UseScheduleTipPromptResult {
  shouldPrompt: boolean;
  dismiss: () => void;
}

function isPushSettled(): boolean {
  return !isPushSupported() || localStorage.getItem(PUSH_PROMPTED_KEY) === "1";
}

// Third step of the onboarding toast chain (install -> push -> schedule
// tip). Waits until the push prompt has been resolved — or was never
// applicable on this browser — before showing, so hackers see one prompt at
// a time instead of everything at once.
export function useScheduleTipPrompt(): UseScheduleTipPromptResult {
  const user = useUserStore((s) => s.user);
  const [dismissed, setDismissed] = useState(false);
  const [pushSettled, setPushSettled] = useState(isPushSettled);

  useEffect(() => {
    if (pushSettled) return;
    function recheck() {
      setPushSettled(isPushSettled());
    }
    window.addEventListener(PUSH_PROMPT_SETTLED_EVENT, recheck);
    return () => window.removeEventListener(PUSH_PROMPT_SETTLED_EVENT, recheck);
  }, [pushSettled]);

  const shouldPrompt =
    !!user &&
    !dismissed &&
    pushSettled &&
    localStorage.getItem(SCHEDULE_TIP_PROMPTED_KEY) !== "1";

  const dismiss = useCallback(() => {
    localStorage.setItem(SCHEDULE_TIP_PROMPTED_KEY, "1");
    setDismissed(true);
  }, []);

  return { shouldPrompt, dismiss };
}
