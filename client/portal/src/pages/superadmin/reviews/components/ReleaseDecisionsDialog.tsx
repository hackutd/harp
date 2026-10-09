import { IconAlertTriangle, IconSend } from "@tabler/icons-react";
import { type ReactNode, useEffect, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { usePriorityDeadline } from "@/pages/admin/_shared";
import { errorAlert } from "@/shared/lib/api";

import { previewDecisionRelease } from "../api";
import { audienceLabel, plural } from "../releaseFormat";
import { useDecisionReleaseStore } from "../releaseStore";
import type {
  DecidedStatus,
  DecisionReleaseAudience,
  DecisionReleaseCounts,
  DecisionReleaseEmail,
  DecisionReleasePreviewResponse,
} from "../types";
import { APPLICATION_STATUS_LABELS, DECIDED_STATUSES } from "../types";

const AUDIENCES: DecisionReleaseAudience[] = [
  "priority",
  "non_priority",
  "everyone",
];

const EMAIL_OPTIONS: {
  value: DecisionReleaseEmail;
  label: string;
  description: string;
}[] = [
  {
    value: "none",
    label: "Don't email",
    description: "Send emails later from Emails.",
  },
  {
    value: "announcement",
    label: "Send “decisions are out”",
    description: "A neutral email that does not reveal the outcome.",
  },
  {
    value: "decision",
    label: "Send each applicant their result",
    description: "The accepted, waitlisted, or rejected email.",
  },
];

/** How many applicants releasing these counts would update. */
function releasable(counts: DecisionReleaseCounts | undefined): number {
  return counts ? counts.new + counts.changed + counts.travel_only : 0;
}

function countsDetail(counts: DecisionReleaseCounts): string {
  const parts = [
    counts.new > 0 && `${counts.new.toLocaleString()} new`,
    counts.changed > 0 && `${counts.changed.toLocaleString()} changed`,
    counts.travel_only > 0 &&
      `${counts.travel_only.toLocaleString()} travel only`,
    counts.unchanged > 0 &&
      `${counts.unchanged.toLocaleString()} already see it`,
  ].filter(Boolean);
  return parts.length > 0 ? parts.join(" · ") : "Nobody in this group";
}

interface ReleaseDecisionsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ReleaseDecisionsDialog({
  open,
  onOpenChange,
}: ReleaseDecisionsDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[92vh] w-full flex-col gap-0 p-0 sm:max-w-3xl">
        {/* Remount on each open so the preview and choices start fresh */}
        {open && <ReleaseDecisionsBody onOpenChange={onOpenChange} />}
      </DialogContent>
    </Dialog>
  );
}

function ReleaseDecisionsBody({
  onOpenChange,
}: {
  onOpenChange: (open: boolean) => void;
}) {
  const deadline = usePriorityDeadline();
  // Until someone picks, default to the priority wave once the deadline has
  // loaded, and to everyone when there is no deadline to release by.
  const [chosenAudience, setChosenAudience] =
    useState<DecisionReleaseAudience | null>(null);
  const audience = chosenAudience ?? (deadline ? "priority" : "everyone");
  const [selected, setSelected] = useState<DecidedStatus[]>([
    ...DECIDED_STATUSES,
  ]);
  const [email, setEmail] = useState<DecisionReleaseEmail>("none");
  const [sendPush, setSendPush] = useState(false);
  const [preview, setPreview] = useState<DecisionReleasePreviewResponse | null>(
    null,
  );
  const [previewLoading, setPreviewLoading] = useState(true);
  const saving = useDecisionReleaseStore((s) => s.saving);
  const createRelease = useDecisionReleaseStore((s) => s.createRelease);

  useEffect(() => {
    const controller = new AbortController();
    async function load() {
      setPreviewLoading(true);
      const res = await previewDecisionRelease(audience, controller.signal);
      if (controller.signal.aborted) return;
      if (res.status === 200 && res.data) {
        setPreview(res.data);
      } else {
        setPreview(null);
        errorAlert(res);
      }
      setPreviewLoading(false);
    }
    load();
    return () => controller.abort();
  }, [audience]);

  const byStatus = preview?.audience === audience ? preview.preview : null;
  const total = selected.reduce(
    (sum, status) => sum + releasable(byStatus?.by_status[status]),
    0,
  );
  const rsvpChanged = selected.reduce(
    (sum, status) => sum + (byStatus?.by_status[status]?.rsvp_changed ?? 0),
    0,
  );
  const underReview = byStatus?.under_review ?? 0;
  const partialAnnouncement =
    email === "announcement" && selected.length < DECIDED_STATUSES.length;
  const canRelease = !previewLoading && !saving && total > 0;

  function toggleStatus(status: DecidedStatus, checked: boolean) {
    setSelected((prev) =>
      checked
        ? DECIDED_STATUSES.filter((s) => s === status || prev.includes(s))
        : prev.filter((s) => s !== status),
    );
  }

  async function handleRelease() {
    const result = await createRelease({
      audience,
      statuses: selected,
      email,
      send_push: email !== "none" && sendPush,
    });
    if (result) onOpenChange(false);
  }

  return (
    <>
      <DialogHeader className="shrink-0 border-b px-6 py-4">
        <DialogTitle className="flex items-center gap-2">
          <IconSend className="size-4" />
          Release decisions
        </DialogTitle>
        <DialogDescription>
          Hackers only see decisions you release. Anything you change afterwards
          stays hidden until a later release covers it.
        </DialogDescription>
      </DialogHeader>

      <div className="flex-1 space-y-5 overflow-y-auto px-6 py-4">
        <section className="space-y-2">
          <h3 className="text-sm font-medium">Who</h3>
          <RadioGroup
            value={audience}
            onValueChange={(value) =>
              setChosenAudience(value as DecisionReleaseAudience)
            }
            className="gap-2"
          >
            {AUDIENCES.map((value) => {
              const needsDeadline = value !== "everyone";
              const disabled = needsDeadline && !deadline;
              return (
                <div key={value} className="flex items-center gap-2">
                  <RadioGroupItem
                    id={`audience-${value}`}
                    value={value}
                    disabled={disabled}
                    className="cursor-pointer"
                  />
                  <Label
                    htmlFor={`audience-${value}`}
                    className={
                      disabled
                        ? "text-sm font-light text-muted-foreground"
                        : "cursor-pointer text-sm font-light"
                    }
                  >
                    {audienceLabel(value, deadline?.toISOString() ?? null)}
                  </Label>
                </div>
              );
            })}
          </RadioGroup>
          {!deadline && (
            <p className="text-xs text-muted-foreground">
              Set a priority deadline in Settings → Hackathon to release by
              priority.
            </p>
          )}
        </section>

        <section className="space-y-2">
          <h3 className="text-sm font-medium">Decisions</h3>
          {previewLoading && !byStatus
            ? DECIDED_STATUSES.map((status) => (
                <Skeleton key={status} className="h-14 w-full rounded-md" />
              ))
            : DECIDED_STATUSES.map((status) => {
                const counts = byStatus?.by_status[status];
                const count = releasable(counts);
                return (
                  <div
                    key={status}
                    className="flex items-start gap-3 rounded-md border p-3"
                  >
                    <Checkbox
                      id={`release-${status}`}
                      checked={selected.includes(status)}
                      onCheckedChange={(checked) =>
                        toggleStatus(status, !!checked)
                      }
                      className="mt-0.5 cursor-pointer"
                    />
                    <div className="grid flex-1 gap-1">
                      <div className="flex items-center justify-between">
                        <Label
                          htmlFor={`release-${status}`}
                          className="cursor-pointer text-sm font-medium"
                        >
                          {APPLICATION_STATUS_LABELS[status]}
                        </Label>
                        <Badge
                          variant="secondary"
                          className="text-xs font-light"
                        >
                          {count.toLocaleString()} to release
                        </Badge>
                      </div>
                      {counts && (
                        <p className="text-xs text-muted-foreground">
                          {countsDetail(counts)}
                        </p>
                      )}
                    </div>
                  </div>
                );
              })}
        </section>

        <section className="space-y-2">
          <h3 className="text-sm font-medium">After releasing</h3>
          <RadioGroup
            value={email}
            onValueChange={(value) => setEmail(value as DecisionReleaseEmail)}
            className="gap-2"
          >
            {EMAIL_OPTIONS.map((option) => (
              <div key={option.value} className="flex items-start gap-2">
                <RadioGroupItem
                  id={`release-email-${option.value}`}
                  value={option.value}
                  className="mt-0.5 cursor-pointer"
                />
                <Label
                  htmlFor={`release-email-${option.value}`}
                  className="grid cursor-pointer gap-0.5 font-light"
                >
                  <span className="text-sm">{option.label}</span>
                  <span className="text-xs text-muted-foreground">
                    {option.description}
                  </span>
                </Label>
              </div>
            ))}
          </RadioGroup>
          <div className="flex items-center justify-between gap-4 pt-1">
            <Label
              htmlFor="release-push"
              className="text-sm font-light text-muted-foreground"
            >
              Also send a push notification (never shows the outcome)
            </Label>
            <Switch
              id="release-push"
              checked={email !== "none" && sendPush}
              onCheckedChange={setSendPush}
              disabled={email === "none"}
              className="cursor-pointer"
            />
          </div>
        </section>

        <div className="space-y-2">
          {underReview > 0 && (
            <Warning>
              {plural(underReview, "applicant")} in this group{" "}
              {underReview === 1 ? "is" : "are"} still under review and won't be
              included.
            </Warning>
          )}
          {rsvpChanged > 0 && (
            <Warning>
              {plural(rsvpChanged, "applicant")} already RSVP'd to a decision
              this release changes.
            </Warning>
          )}
          {partialAnnouncement && (
            <Warning>
              Only{" "}
              {selected
                .map((s) => APPLICATION_STATUS_LABELS[s])
                .join(" and ")
                .toLowerCase()}{" "}
              applicants get the announcement, so receiving it reveals the
              outcome. Include every status, or send each applicant their result
              instead.
            </Warning>
          )}
          {email !== "none" && (
            <p className="text-xs text-muted-foreground">
              You can undo this release later, but emails can't be recalled.
            </p>
          )}
        </div>
      </div>

      <DialogFooter className="shrink-0 border-t px-6 py-4 sm:justify-end">
        <Button
          variant="outline"
          size="sm"
          className="cursor-pointer font-light"
          onClick={() => onOpenChange(false)}
        >
          Cancel
        </Button>
        <Button
          size="sm"
          className="cursor-pointer font-light"
          disabled={!canRelease}
          loading={saving}
          onClick={handleRelease}
        >
          Release {plural(total, "decision")}
        </Button>
      </DialogFooter>
    </>
  );
}

function Warning({ children }: { children: ReactNode }) {
  return (
    <div
      className="flex items-start gap-1.5 rounded-md bg-yellow-50 p-2 text-yellow-800"
      role="alert"
    >
      <IconAlertTriangle className="mt-0.5 size-3.5 shrink-0" />
      <p className="text-xs">{children}</p>
    </div>
  );
}
