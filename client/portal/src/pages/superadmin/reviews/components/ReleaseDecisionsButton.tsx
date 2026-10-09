import { IconHistory, IconSend } from "@tabler/icons-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";

import { ReleaseDecisionsDialog } from "./ReleaseDecisionsDialog";
import { ReleaseHistoryDialog } from "./ReleaseHistoryDialog";

/** Opens the release dialog, and the history of releases with undo. */
export function ReleaseDecisionsButton() {
  const [releaseOpen, setReleaseOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);

  return (
    <>
      <Button
        variant="outline"
        size="sm"
        className="cursor-pointer font-light"
        aria-label="Release history"
        title="Release history"
        onClick={() => setHistoryOpen(true)}
      >
        <IconHistory className="size-3.5" />
      </Button>
      <Button
        size="sm"
        className="cursor-pointer font-light"
        onClick={() => setReleaseOpen(true)}
      >
        <IconSend className="size-3.5" />
        Release Decisions
      </Button>

      <ReleaseDecisionsDialog
        open={releaseOpen}
        onOpenChange={setReleaseOpen}
      />
      <ReleaseHistoryDialog open={historyOpen} onOpenChange={setHistoryOpen} />
    </>
  );
}
