import { IconEyeOff, IconRotateClockwise, IconSend } from "@tabler/icons-react";
import { useEffect, useState } from "react";

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
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { ApplicationStats } from "@/pages/admin/all-applicants/types";

import { useDecisionReleaseStore } from "../releaseStore";

interface ReleaseDecisionsButtonProps {
  stats: ApplicationStats | null;
}

export function ReleaseDecisionsButton({ stats }: ReleaseDecisionsButtonProps) {
  const released = useDecisionReleaseStore((s) => s.released);
  const loading = useDecisionReleaseStore((s) => s.loading);
  const saving = useDecisionReleaseStore((s) => s.saving);
  const error = useDecisionReleaseStore((s) => s.error);
  const fetchReleased = useDecisionReleaseStore((s) => s.fetchReleased);
  const setReleased = useDecisionReleaseStore((s) => s.setReleased);
  const [confirmOpen, setConfirmOpen] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    fetchReleased(controller.signal);
    return () => controller.abort();
  }, [fetchReleased]);

  if (released === null) {
    return (
      <Button
        variant="outline"
        size="sm"
        className="cursor-pointer font-light"
        disabled={loading}
        loading={loading}
        onClick={() => void fetchReleased()}
        title={error ?? undefined}
      >
        {!loading && <IconRotateClockwise className="size-3.5" />}
        {loading ? "Loading release status" : "Retry release status"}
      </Button>
    );
  }

  async function handleConfirm() {
    setConfirmOpen(false);
    await setReleased(!released);
  }

  return (
    <>
      {released && (
        <Badge variant="secondary" className="font-light">
          Decisions released
        </Badge>
      )}
      <Button
        variant={released ? "outline" : "default"}
        size="sm"
        className="cursor-pointer font-light"
        disabled={saving}
        loading={saving}
        onClick={() => setConfirmOpen(true)}
      >
        {released ? (
          <>
            <IconEyeOff className="size-3.5" />
            Hide Decisions
          </>
        ) : (
          <>
            <IconSend className="size-3.5" />
            Release Decisions
          </>
        )}
      </Button>

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {released
                ? "Hide decisions from hackers?"
                : "Release decisions to hackers?"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {released
                ? "Hackers will see their application as under review again and cannot RSVP until you release decisions. RSVPs already submitted are kept."
                : "Every accepted, waitlisted, and rejected applicant will see their result on the portal immediately, and accepted hackers can RSVP. Any decision you set afterwards is visible as soon as it is saved."}
            </AlertDialogDescription>
            {!released && stats && (
              <p className="text-sm text-muted-foreground">
                {stats.accepted} accepted, {stats.waitlisted} waitlisted,{" "}
                {stats.rejected} rejected
                {stats.submitted > 0 &&
                  `; ${stats.submitted} still under review`}
                .
              </p>
            )}
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="cursor-pointer">
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirm}
              className="cursor-pointer"
            >
              {released ? "Yes, Hide Decisions" : "Yes, Release Decisions"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
