import { isStandalone } from "@/shared/install/platform";
import { isPushSupported } from "@/shared/push/client";

import { wasPrompted } from "./storage";
import type { OnboardingStepId } from "./types";

export const STEP_ORDER: OnboardingStepId[] = [
  "install",
  "push",
  "schedule-tip",
];

// Every platform gets this step — desktop included, where it points the user at
// their phone instead (push notifications need the app on a home screen, and
// the hackathon itself is run off a phone). There is nothing left to ask once
// the app is already running standalone.
export function isInstallApplicable(): boolean {
  return !isStandalone();
}

// iOS 16.4+ only exposes web push to home-screen apps, so the standalone gate
// is required, not incidental. Once permission has been granted or denied there
// is nothing left to ask.
export function isPushApplicable(): boolean {
  return (
    isPushSupported() && isStandalone() && Notification.permission === "default"
  );
}

// Only the steps that can block later ones need a predicate here — the last
// step in STEP_ORDER blocks nothing, and its applicability is supplied by the
// caller (whether a schedule has been configured).
const APPLICABILITY: Partial<Record<OnboardingStepId, () => boolean>> = {
  install: isInstallApplicable,
  push: isPushApplicable,
};

// Whether this step could show on this device at all. Steps without a
// predicate (the schedule tip) are device-agnostic — their own hosts supply
// the remaining conditions.
export function isStepApplicable(id: OnboardingStepId): boolean {
  return APPLICABILITY[id]?.() ?? true;
}

// A step is done when it has been prompted OR when it never applied on this
// device. Treating "not applicable" as settled is what stops the chain
// stalling — otherwise a desktop user, or anyone who never installs the PWA,
// blocks every step behind them forever.
export function isStepSettled(id: OnboardingStepId): boolean {
  return wasPrompted(id) || !isStepApplicable(id);
}

export function areEarlierStepsSettled(id: OnboardingStepId): boolean {
  return STEP_ORDER.slice(0, STEP_ORDER.indexOf(id)).every(isStepSettled);
}
