import { useEffect } from "react";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";

import { useReferralsStore } from "../store";
import type { Referral } from "../types";

interface SignupsDialogProps {
  referral: Referral | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function SignupsDialog({
  referral,
  open,
  onOpenChange,
}: SignupsDialogProps) {
  const signupsReferralID = useReferralsStore((s) => s.signupsReferralID);
  const loadedSignups = useReferralsStore((s) => s.signups);
  const fetchSignups = useReferralsStore((s) => s.fetchSignups);
  const referralID = referral?.id;
  const signups = signupsReferralID === referralID ? loadedSignups : null;

  useEffect(() => {
    if (!open || !referralID) return;
    const controller = new AbortController();
    fetchSignups(referralID, controller.signal);
    return () => controller.abort();
  }, [open, referralID, fetchSignups]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Signups from {referral?.name}</DialogTitle>
          <DialogDescription>
            Accounts created after following this link, newest first.
          </DialogDescription>
        </DialogHeader>
        {signups === null ? (
          <Skeleton className="h-24 w-full" />
        ) : signups.length === 0 ? (
          <p className="text-sm text-muted-foreground">No signups yet.</p>
        ) : (
          <ul className="max-h-80 divide-y overflow-y-auto rounded-md border">
            {signups.map((s) => (
              <li
                key={s.user_id}
                className="flex items-center justify-between gap-3 px-3 py-2 text-sm"
              >
                <span className="min-w-0 truncate">{s.email}</span>
                <span className="shrink-0 text-xs text-muted-foreground">
                  {new Date(s.created_at).toLocaleString()}
                </span>
              </li>
            ))}
          </ul>
        )}
      </DialogContent>
    </Dialog>
  );
}
