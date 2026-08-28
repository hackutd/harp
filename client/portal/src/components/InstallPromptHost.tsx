import { useEffect, useState } from "react";

import { InstallGuideDialog } from "@/components/InstallGuideDialog";
import { useInstallPrompt } from "@/shared/install";
import { useUserStore } from "@/shared/stores";

export function InstallPromptHost() {
  const user = useUserStore((s) => s.user);
  const { shouldPrompt, platform, installed, dismiss } = useInstallPrompt();
  const [closed, setClosed] = useState(false);

  const isMobile = platform === "ios" || platform === "android";

  // On a phone browser (not yet installed), walk the user through adding the
  // app to their home screen every visit — not just the first — since the
  // whole event runs off the installed app.
  const guideOpen = !!user && !installed && isMobile && !closed;

  // There is nothing to install on desktop, so settle the onboarding step
  // immediately rather than stranding the steps behind it.
  useEffect(() => {
    if (shouldPrompt && !isMobile) dismiss();
  }, [shouldPrompt, isMobile, dismiss]);

  return (
    <InstallGuideDialog
      open={guideOpen}
      onOpenChange={(open) => {
        if (!open) {
          setClosed(true);
          dismiss();
        }
      }}
    />
  );
}
