import { useEffect } from "react";
import { toast } from "sonner";

import { useScheduleTipPrompt } from "@/shared/schedule-tip";

import { getScheduleDateRange } from "../schedule/api";

const TOAST_ID = "schedule-tip";

export function ScheduleTipHost() {
  const { shouldPrompt, dismiss } = useScheduleTipPrompt();

  useEffect(() => {
    if (!shouldPrompt) return;

    let cancelled = false;
    const controller = new AbortController();

    void getScheduleDateRange(controller.signal).then((res) => {
      if (cancelled || res.status !== 200 || !res.data?.configured) return;

      toast("Browsing the schedule", {
        id: TOAST_ID,
        description:
          "Tap any event to see its details. Use the filter icon in the top corner to show only certain event types.",
        duration: Infinity,
        cancel: {
          label: "Got it",
          onClick: () => dismiss(),
        },
      });
    });

    return () => {
      cancelled = true;
      controller.abort();
      toast.dismiss(TOAST_ID);
    };
  }, [shouldPrompt, dismiss]);

  return null;
}
