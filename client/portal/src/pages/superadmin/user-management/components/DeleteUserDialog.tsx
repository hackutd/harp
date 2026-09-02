import { useState } from "react";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

import type { PendingUserDeletion } from "../types";

const CONFIRM_PHRASE = "DELETE";

interface DeleteUserDialogProps {
  pendingDeletion: PendingUserDeletion | null;
  deleting: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export function DeleteUserDialog({
  pendingDeletion,
  deleting,
  onConfirm,
  onCancel,
}: DeleteUserDialogProps) {
  const [confirmText, setConfirmText] = useState("");

  // The dialog stays mounted between targets, so the typed confirmation has to
  // be cleared whenever the target changes -- otherwise it carries over and arms
  // the button for the next account before anything is typed. Closing after a
  // successful delete is a controlled prop change, which does not fire
  // onOpenChange, so resetting during render is what catches every path.
  const [lastUserId, setLastUserId] = useState(pendingDeletion?.userId);
  if (pendingDeletion?.userId !== lastUserId) {
    setLastUserId(pendingDeletion?.userId);
    setConfirmText("");
  }

  const confirmed = confirmText === CONFIRM_PHRASE;

  return (
    <AlertDialog
      open={pendingDeletion !== null}
      onOpenChange={(open) => {
        if (!open) onCancel();
      }}
    >
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete Account</AlertDialogTitle>
          <AlertDialogDescription asChild>
            <div className="space-y-3">
              <p>
                Permanently delete{" "}
                <span className="font-medium text-foreground">
                  {pendingDeletion?.name || pendingDeletion?.email}
                </span>
                {pendingDeletion?.name ? ` (${pendingDeletion.email})` : ""}?
                This cannot be undone.
              </p>
              <p>This removes:</p>
              <ul className="list-disc space-y-1 pl-5">
                <li>Their application and every answer on it</li>
                <li>Their resume and any travel receipts</li>
                <li>Their scans, points, and RSVP</li>
                <li>Any reviews they wrote, and the votes those carried</li>
                <li>Their login</li>
              </ul>
              <p>
                Scans they performed and notifications they scheduled are kept,
                without their name attached.
              </p>
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>

        <div className="space-y-2">
          <Label htmlFor="confirm-delete-user">
            Type <strong className="text-destructive">{CONFIRM_PHRASE}</strong>{" "}
            to confirm
          </Label>
          <Input
            id="confirm-delete-user"
            value={confirmText}
            onChange={(e) => setConfirmText(e.target.value)}
            placeholder={CONFIRM_PHRASE}
            disabled={deleting}
            autoComplete="off"
          />
        </div>

        <AlertDialogFooter>
          <AlertDialogCancel className="cursor-pointer" disabled={deleting}>
            Cancel
          </AlertDialogCancel>
          <AlertDialogAction
            className="cursor-pointer bg-destructive text-white hover:bg-destructive/90"
            disabled={!confirmed || deleting}
            onClick={(e) => {
              // Keep the dialog mounted while the request is in flight so the
              // button can show progress.
              e.preventDefault();
              if (!confirmed) return;
              onConfirm();
            }}
          >
            {deleting ? "Deleting..." : "Delete"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
