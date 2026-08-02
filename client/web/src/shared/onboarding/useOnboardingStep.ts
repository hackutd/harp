import { useCallback, useSyncExternalStore } from "react";

import { areEarlierStepsSettled, isStepApplicable } from "./steps";
import { markPrompted, subscribeToOnboarding, wasPrompted } from "./storage";
import type { OnboardingStepId } from "./types";

export interface UseOnboardingStepResult {
  /** This step is the one that should be on screen right now. */
  isActive: boolean;
  /** Mark the step done and hand off to the next applicable one. */
  settle: () => void;
}

/**
 * Places one step in the onboarding chain.
 *
 * Device-level applicability comes from the registry, so the same predicate
 * decides both "may I show?" and "do I block the steps after me?" — the two can
 * never disagree. `enabled` is only for what the caller alone knows: a signed-in
 * user, a loaded schedule.
 *
 * At most one step is ever active: a step stays blocked until every earlier step
 * has been prompted or has turned out not to apply on this device.
 */
export function useOnboardingStep(
  id: OnboardingStepId,
  enabled: boolean,
): UseOnboardingStepResult {
  // useSyncExternalStore is the sanctioned way to read a mutable external
  // source (localStorage, display-mode, notification permission) — it keeps the
  // read out of the render body and re-runs it for every mounted step when one
  // of them settles or the device changes underneath.
  const getSnapshot = useCallback(
    () =>
      isStepApplicable(id) && !wasPrompted(id) && areEarlierStepsSettled(id),
    [id],
  );
  const isReady = useSyncExternalStore(subscribeToOnboarding, getSnapshot);

  const settle = useCallback(() => markPrompted(id), [id]);

  return { isActive: enabled && isReady, settle };
}
