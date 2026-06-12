import { useEffect } from "react";
import { toast } from "sonner";

import { usePushPrompt } from "@/shared/push/usePushPrompt";

const TOAST_ID = "push-prompt";

export function PushPromptHost() {
  const { shouldPrompt, accept, dismiss } = usePushPrompt();

  useEffect(() => {
    if (!shouldPrompt) return;

    toast("Get notified about your application status", {
      id: TOAST_ID,
      description:
        "Allow push notifications so we can let you know when reviews and announcements drop.",
      duration: Infinity,
      action: {
        label: "Enable",
        onClick: () => {
          void accept();
        },
      },
      cancel: {
        label: "Not now",
        onClick: () => {
          dismiss();
        },
      },
    });

    return () => {
      toast.dismiss(TOAST_ID);
    };
  }, [shouldPrompt, accept, dismiss]);

  return null;
}
