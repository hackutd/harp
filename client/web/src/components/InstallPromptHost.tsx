import { Share } from "lucide-react";
import { useEffect } from "react";
import { toast } from "sonner";

import { useInstallPrompt } from "@/shared/install";

const TOAST_ID = "install-prompt";

export function InstallPromptHost() {
  const { shouldPrompt, platform, canPromptNatively, promptInstall, dismiss } =
    useInstallPrompt();

  useEffect(() => {
    // Android/Chromium: only worth showing once the browser has actually
    // offered a native install prompt to trigger.
    if (!shouldPrompt || (platform === "android" && !canPromptNatively)) {
      return;
    }

    if (platform === "ios") {
      toast("Add HARP to your home screen", {
        id: TOAST_ID,
        description: (
          <span className="flex items-center gap-1.5">
            Tap
            <Share className="inline size-3.5" strokeWidth={2} />
            then "Add to Home Screen" to install and get notified.
          </span>
        ),
        duration: Infinity,
        cancel: {
          label: "Got it",
          onClick: () => dismiss(),
        },
      });
    } else {
      toast("Install HARP for the full experience", {
        id: TOAST_ID,
        description:
          "Add the app to your home screen to get notified about your application status.",
        duration: Infinity,
        action: {
          label: "Install",
          onClick: () => {
            void promptInstall();
          },
        },
        cancel: {
          label: "Not now",
          onClick: () => dismiss(),
        },
      });
    }

    return () => {
      toast.dismiss(TOAST_ID);
    };
  }, [shouldPrompt, platform, canPromptNatively, promptInstall, dismiss]);

  return null;
}
