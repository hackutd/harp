import { Share } from "lucide-react";
import { useEffect, useRef } from "react";
import { toast } from "sonner";

import { useInstallPrompt } from "@/shared/install";

const TOAST_ID = "install-prompt";

export function InstallPromptHost() {
  const { shouldPrompt, platform, canPromptNatively, promptInstall, dismiss } =
    useInstallPrompt();
  const shown = useRef(false);

  useEffect(() => {
    if (!shouldPrompt) {
      if (shown.current) {
        toast.dismiss(TOAST_ID);
        shown.current = false;
      }
      return;
    }

    if (platform === "ios") {
      toast("Add HARP to your home screen", {
        id: TOAST_ID,
        description: (
          <span>
            <span className="inline-flex items-center gap-1 whitespace-nowrap">
              Tap <Share className="size-3.5" strokeWidth={2} />
            </span>{" "}
            then "Add to Home Screen" to install and get notified.
          </span>
        ),
        duration: Infinity,
        cancel: {
          label: "Got it",
          onClick: () => dismiss(),
        },
      });
    } else if (platform === "desktop") {
      // Nothing useful to install here: web push only reaches a phone that has
      // the app on its home screen, so point the user at their phone rather
      // than installing a desktop PWA they will not carry around the event.
      toast("Open HARP on your phone", {
        id: TOAST_ID,
        description:
          "Add HARP to your phone's home screen to get notified about your application status.",
        duration: Infinity,
        cancel: {
          label: "Got it",
          onClick: () => dismiss(),
        },
      });
    } else if (canPromptNatively) {
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
    } else {
      // Android/Chromium before — or without — a beforeinstallprompt event.
      // Showing manual instructions rather than nothing matters: this step
      // blocks the rest of the chain while it is unresolved, so bailing out
      // here would strand push and the schedule tip behind a toast that never
      // appears. If the event does arrive later the effect re-runs and sonner
      // updates this toast in place, adding the one-tap Install action.
      toast("Add HARP to your home screen", {
        id: TOAST_ID,
        description:
          'Open your browser menu and choose "Install app" to get notified about your application status.',
        duration: Infinity,
        cancel: {
          label: "Got it",
          onClick: () => dismiss(),
        },
      });
    }

    shown.current = true;
  }, [shouldPrompt, platform, canPromptNatively, promptInstall, dismiss]);

  // Only tear the toast down when the host itself unmounts — dismissing on
  // every dependency change would flicker when canPromptNatively flips.
  useEffect(() => {
    return () => {
      toast.dismiss(TOAST_ID);
    };
  }, []);

  return null;
}
