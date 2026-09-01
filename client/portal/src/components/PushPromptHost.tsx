import { useState } from "react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { usePushPrompt } from "@/shared/push/usePushPrompt";

export function PushPromptHost() {
  const { shouldPrompt, accept, dismiss } = usePushPrompt();
  const [enabling, setEnabling] = useState(false);

  const handleOpenChange = (open: boolean) => {
    if (!open && !enabling) dismiss();
  };

  const handleEnable = async () => {
    setEnabling(true);
    try {
      await accept();
    } finally {
      setEnabling(false);
    }
  };

  return (
    <Dialog open={shouldPrompt} onOpenChange={handleOpenChange}>
      <DialogContent className="flex max-w-xs flex-col rounded-xl p-5 sm:max-w-xs">
        <DialogHeader>
          <DialogTitle className="font-normal">Get Notified</DialogTitle>
          <DialogDescription>
            Allow push notifications so we can let you know when reviews and
            announcements drop.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-2">
          <Button
            type="button"
            className="w-full rounded-full"
            loading={enabling}
            onClick={() => {
              void handleEnable();
            }}
          >
            Allow notifications
          </Button>
          <Button
            type="button"
            variant="outline"
            className="w-full rounded-full"
            disabled={enabling}
            onClick={() => dismiss()}
          >
            Not now
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
