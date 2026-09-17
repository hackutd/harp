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
import type { UserRole } from "@/types";

import type { PendingRoleChange } from "../types";
import { roleLabels } from "../utils";

interface RoleChangeDialogProps {
  pendingChange: PendingRoleChange | null;
  currentRole: UserRole;
  onConfirm: () => void;
  onCancel: () => void;
}

export function RoleChangeDialog({
  pendingChange,
  currentRole,
  onConfirm,
  onCancel,
}: RoleChangeDialogProps) {
  return (
    <AlertDialog
      open={pendingChange !== null}
      onOpenChange={(open) => {
        if (!open) onCancel();
      }}
    >
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Confirm Role Change</AlertDialogTitle>
          <AlertDialogDescription>
            Change {pendingChange?.email} from {roleLabels[currentRole]} to{" "}
            {roleLabels[pendingChange?.newRole ?? "hacker"]}?
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction onClick={onConfirm}>Confirm</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
