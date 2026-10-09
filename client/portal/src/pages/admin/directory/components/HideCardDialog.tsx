import { useState } from "react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

import type { DirectoryAdminProfile } from "../types";
import { MODERATION_REASON_MAX } from "../utils";

interface HideCardDialogProps {
  profile: DirectoryAdminProfile | null;
  open: boolean;
  saving: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: (reason: string) => void;
}

export function HideCardDialog({
  profile,
  open,
  saving,
  onOpenChange,
  onConfirm,
}: HideCardDialogProps) {
  const [reason, setReason] = useState("");
  const [wasOpen, setWasOpen] = useState(open);
  // Start each opening with an empty reason.
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) setReason("");
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Hide {profile?.display_name}'s card?</DialogTitle>
          <DialogDescription>
            The card disappears from every directory list and its owner can't
            send new pokes or save contacts. They see a "card under review"
            notice and can't turn it back on themselves.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-2">
          <Label htmlFor="moderation-reason">
            Reason (only admins see this)
          </Label>
          <Textarea
            id="moderation-reason"
            value={reason}
            maxLength={MODERATION_REASON_MAX}
            onChange={(e) => setReason(e.target.value)}
            placeholder="e.g. inappropriate photo"
          />
          <p className="text-right text-xs text-muted-foreground">
            {reason.length}/{MODERATION_REASON_MAX}
          </p>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            variant="destructive"
            disabled={saving}
            onClick={() => onConfirm(reason)}
          >
            {saving ? "Hiding..." : "Hide card"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
