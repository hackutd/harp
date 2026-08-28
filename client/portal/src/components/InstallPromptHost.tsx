import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import { branding } from "@/branding";
import { InstallGuideDialog } from "@/components/InstallGuideDialog";
import { useInstallPrompt } from "@/shared/install";

const TOAST_ID = "install-prompt";

export function InstallPromptHost() {
  const { shouldPrompt, platform, canPromptNatively, promptInstall, dismiss } =
    useInstallPrompt();
  const shown = useRef(false);
  const [guideOpen, setGuideOpen] = useState(false);

  useEffect(() => {
    if (!shouldPrompt) {
      if (shown.current) {
        toast.dismiss(TOAST_ID);
        shown.current = false;
      }
      return;
    }

    if (platform === "ios") {
      toast(`Add ${branding.appName} to your home screen`, {
        id: TOAST_ID,
        description:
          "Install the app on your home screen to get notified about your application status.",
        duration: Infinity,
        action: {
          label: "Show me how",
          onClick: () => setGuideOpen(true),
        },
        cancel: {
          label: "Got it",
          onClick: () => dismiss(),
        },
      });
    } else if (platform === "desktop") {
      // Nothing useful to install here: web push only reaches a phone that has
      // the app on its home screen, so point the user at their phone rather
      // than installing a desktop PWA they will not carry around the event.
      toast(`Open ${branding.appName} on your phone`, {
        id: TOAST_ID,
        description: `Add ${branding.appName} to your phone's home screen to get notified about your application status.`,
        duration: Infinity,
        cancel: {
          label: "Got it",
          onClick: () => dismiss(),
        },
      });
    } else if (canPromptNatively) {
      toast(`Install ${branding.appName} for the full experience`, {
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
      toast(`Add ${branding.appName} to your home screen`, {
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

  return (
    <InstallGuideDialog
      open={guideOpen}
      onOpenChange={(open) => {
        setGuideOpen(open);
        if (!open) dismiss();
      }}
    />
  );
}
