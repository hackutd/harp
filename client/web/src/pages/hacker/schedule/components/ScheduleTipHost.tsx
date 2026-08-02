import { useEffect } from "react";
import { toast } from "sonner";

import { useOnboardingStep } from "@/shared/onboarding";

const TOAST_ID = "schedule-tip";

interface ScheduleTipHostProps {
  /**
   * Whether the tip makes sense yet — the schedule has loaded and actually has
   * events to browse. Owned by the page, since the tip describes this page's UI.
   */
  ready: boolean;
}

// Last step of the onboarding chain. Mounted by SchedulePage rather than the
// hacker layout so it can only ever fire on /app/schedule, where the filter
// icon and tappable events it describes exist.
export function ScheduleTipHost({ ready }: ScheduleTipHostProps) {
  const { isActive, settle } = useOnboardingStep("schedule-tip", ready);

  useEffect(() => {
    if (!isActive) return;

    toast("Browsing the schedule", {
      id: TOAST_ID,
      description:
        "Tap any event to see its details. Use the filter icon in the top corner to show only certain event types.",
      duration: Infinity,
      cancel: {
        label: "Got it",
        onClick: () => settle(),
      },
    });

    return () => {
      toast.dismiss(TOAST_ID);
    };
  }, [isActive, settle]);

  return null;
}
