import { IconArrowBackUp, IconHistory } from "@tabler/icons-react";
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";

import { audienceLabel, formatReleaseDate, plural } from "../releaseFormat";
import { latestActiveRelease, useDecisionReleaseStore } from "../releaseStore";
import type { DecisionRelease } from "../types";
import { APPLICATION_STATUS_LABELS } from "../types";

interface ReleaseHistoryDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/** Every decision release, newest first, with undo for the latest in effect. */
export function ReleaseHistoryDialog({
  open,
  onOpenChange,
}: ReleaseHistoryDialogProps) {
  const releases = useDecisionReleaseStore((s) => s.releases);
  const loading = useDecisionReleaseStore((s) => s.loading);
  const error = useDecisionReleaseStore((s) => s.error);
  const saving = useDecisionReleaseStore((s) => s.saving);
  const fetchReleases = useDecisionReleaseStore((s) => s.fetchReleases);
  const undoRelease = useDecisionReleaseStore((s) => s.undoRelease);
  const [undoTarget, setUndoTarget] = useState<DecisionRelease | null>(null);

  useEffect(() => {
    if (!open) return;
    const controller = new AbortController();
    fetchReleases(controller.signal);
    return () => controller.abort();
  }, [open, fetchReleases]);

  const latest = latestActiveRelease(releases);

  async function handleUndo() {
    if (!undoTarget) return;
    const target = undoTarget;
    setUndoTarget(null);
    await undoRelease(target.id);
  }

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="flex max-h-[92vh] w-full flex-col gap-0 p-0 sm:max-w-3xl">
          <DialogHeader className="shrink-0 border-b px-6 py-4">
            <DialogTitle className="flex items-center gap-2">
              <IconHistory className="size-4" />
              Release history
            </DialogTitle>
            <DialogDescription>
              Each release published the decisions of one group. The most recent
              one still in effect can be undone.
            </DialogDescription>
          </DialogHeader>

          <div className="flex-1 space-y-2 overflow-y-auto px-6 py-4">
            {releases === null && loading ? (
              [0, 1].map((i) => (
                <Skeleton key={i} className="h-20 w-full rounded-md" />
              ))
            ) : releases === null ? (
              <p className="text-sm text-muted-foreground">
                {error ?? "Unable to load decision releases."}
              </p>
            ) : releases.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No decisions have been released yet. Hackers see every
                application as under review.
              </p>
            ) : (
              releases.map((release) => (
                <div
                  key={release.id}
                  className="flex items-start justify-between gap-4 rounded-md border p-3"
                >
                  <div className="grid gap-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-sm font-medium">
                        {plural(release.released_count, "decision")}
                      </span>
                      {release.undone_at && (
                        <Badge
                          variant="secondary"
                          className="text-xs font-light"
                        >
                          Undone
                        </Badge>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {audienceLabel(
                        release.audience,
                        release.priority_deadline,
                      )}{" "}
                      ·{" "}
                      {release.statuses
                        .map((s) => APPLICATION_STATUS_LABELS[s])
                        .join(", ")}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {formatReleaseDate(release.created_at)}
                      {release.released_by_email &&
                        ` by ${release.released_by_email}`}
                      {!release.undone_at &&
                        release.emailed_count > 0 &&
                        ` · ${plural(release.emailed_count, "applicant")} emailed`}
                    </p>
                    {release.undone_at && (
                      <p className="text-xs text-muted-foreground">
                        Undone {formatReleaseDate(release.undone_at)}
                        {release.undone_by_email &&
                          ` by ${release.undone_by_email}`}
                      </p>
                    )}
                  </div>
                  {release.id === latest?.id && (
                    <Button
                      variant="outline"
                      size="sm"
                      className="shrink-0 cursor-pointer font-light"
                      disabled={saving}
                      onClick={() => setUndoTarget(release)}
                    >
                      <IconArrowBackUp className="size-3.5" />
                      Undo
                    </Button>
                  )}
                </div>
              ))
            )}
          </div>
        </DialogContent>
      </Dialog>

      <AlertDialog
        open={undoTarget !== null}
        onOpenChange={(next) => !next && setUndoTarget(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Undo this release?</AlertDialogTitle>
            <AlertDialogDescription>
              {undoTarget &&
                `${plural(undoTarget.released_count, "applicant")} go back to what they saw before it: under review, or the decision an earlier release gave them. Their current decisions are not changed, so you can fix them and release again.`}
            </AlertDialogDescription>
            {undoTarget && undoTarget.emailed_count > 0 && (
              <p className="text-sm text-yellow-700">
                {plural(undoTarget.emailed_count, "applicant")}{" "}
                {undoTarget.emailed_count === 1 ? "has" : "have"} already been
                emailed. Those emails can't be recalled.
              </p>
            )}
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="cursor-pointer">
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction onClick={handleUndo} className="cursor-pointer">
              Yes, undo release
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
