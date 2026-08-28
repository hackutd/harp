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
      <DialogContent className="max-w-sm rounded-xl p-5 sm:max-w-sm">
        <DialogHeader>
          <DialogTitle className="font-normal">
            Get notified about your application status
          </DialogTitle>
          <DialogDescription>
            Allow push notifications so we can let you know when reviews and
            announcements drop.
          </DialogDescription>
        </DialogHeader>

        <div className="flex items-center justify-between gap-2">
          <Button
            type="button"
            variant="outline"
            className="rounded-full"
            disabled={enabling}
            onClick={() => dismiss()}
          >
            Not now
          </Button>
          <Button
            type="button"
            className="rounded-full"
            loading={enabling}
            onClick={() => {
              void handleEnable();
            }}
          >
            Allow notifications
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
