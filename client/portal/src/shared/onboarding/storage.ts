import type { OnboardingStepId } from "./types";

// Fired whenever any step is settled, so sibling steps mounted in the same tab
// can advance without waiting for a reload. localStorage's own "storage" event
// only fires in *other* tabs, hence the custom event.
export const ONBOARDING_SETTLED_EVENT = "onboarding-step-settled";

// Kept verbatim from the original per-step constants so hackers who already
// dismissed a prompt are not asked again.
export const STEP_KEYS: Record<OnboardingStepId, string> = {
  install: "install-prompted-v1",
  push: "push-prompted-v1",
  "schedule-tip": "schedule-tip-prompted-v1",
};

// Storage can be unavailable (Safari private mode, blocked cookies). Failing to
// read means "not prompted yet"; failing to write means the step still advances
// this session and simply re-prompts on the next load. Neither should throw
// through a toast's onClick.
export function wasPrompted(id: OnboardingStepId): boolean {
  try {
    return localStorage.getItem(STEP_KEYS[id]) === "1";
  } catch {
    return false;
  }
}

export function markPrompted(id: OnboardingStepId): void {
  try {
    localStorage.setItem(STEP_KEYS[id], "1");
  } catch {
    // Ignored — see above.
  }
  window.dispatchEvent(new Event(ONBOARDING_SETTLED_EVENT));
}

// Steps also have to recompute when the *device* changes under them, not just
// when a sibling settles: "appinstalled" fires on Android, and iOS's silent
// flip to standalone is only observable once the user comes back to the tab.
export function subscribeToOnboarding(onChange: () => void): () => void {
  window.addEventListener(ONBOARDING_SETTLED_EVENT, onChange);
  window.addEventListener("appinstalled", onChange);
  window.addEventListener("focus", onChange);
  document.addEventListener("visibilitychange", onChange);
  return () => {
    window.removeEventListener(ONBOARDING_SETTLED_EVENT, onChange);
    window.removeEventListener("appinstalled", onChange);
    window.removeEventListener("focus", onChange);
    document.removeEventListener("visibilitychange", onChange);
  };
}
