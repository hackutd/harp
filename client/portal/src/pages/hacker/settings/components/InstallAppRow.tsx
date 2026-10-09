import { IconNfc } from "@tabler/icons-react";
import { useState } from "react";

import { InstallGuideDialog } from "@/components/InstallGuideDialog";
import { useInstallPrompt } from "@/shared/install";

/** Opens the add-to-home-screen guide; hidden once the app is installed. */
export function InstallAppRow() {
  const install = useInstallPrompt();
  const [guideOpen, setGuideOpen] = useState(false);

  if (install.installed) return null;

  return (
    <>
      <button
        type="button"
        onClick={() => setGuideOpen(true)}
        className="flex min-h-[68px] w-full items-center justify-between px-5 py-4 text-left transition-colors hover:bg-ink/5"
      >
        <div className="flex items-center gap-3">
          <IconNfc className="size-4.5 text-ink" strokeWidth={1.5} />
          <div>
            <p className="text-sm font-normal text-ink">Install app</p>
            <p className="text-xs font-light text-ink/65">
              {install.platform === "desktop"
                ? "Add it to your phone's home screen for the full experience"
                : "Add to home screen for the full experience"}
            </p>
          </div>
        </div>
      </button>
      <InstallGuideDialog open={guideOpen} onOpenChange={setGuideOpen} />
    </>
  );
}
