import {
  Download,
  FileDown,
  Mail,
  Megaphone,
  TriangleAlert,
} from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

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
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type {
  ApplicationStats,
  ApplicationStatus,
} from "@/pages/admin/all-applicants/types";
import { errorAlert } from "@/shared/lib/api";

import {
  fetchApplicantEmails,
  fetchDecisionEmailStats,
  sendDecisionEmails,
} from "../api";
import type {
  DecidedStatus,
  DecisionEmailMode,
  DecisionEmailStats,
} from "../types";
import {
  APPLICATION_STATUS_LABELS,
  APPLICATION_STATUSES,
  DECIDED_STATUSES,
} from "../types";

type EmailsTab = DecisionEmailMode | "export";

const STATUS_DESCRIPTIONS: Record<DecidedStatus, string> = {
  accepted: "Congratulations email with a link to the portal.",
  waitlisted: "Explains the waitlist and that spots may still open up.",
  rejected: "Warm decline that encourages reapplying next year.",
};

function csvEscape(value: string | null) {
  const str = value ?? "";
  if (/[",\n\r]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

interface SendEmailsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  stats: ApplicationStats | null;
}

export function SendEmailsDialog({
  open,
  onOpenChange,
  stats,
}: SendEmailsDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex h-[92vh] w-full flex-col gap-0 p-0 sm:max-w-3xl">
        {/* Remount on each open so counts and selections start fresh */}
        {open && (
          <SendEmailsDialogBody onOpenChange={onOpenChange} stats={stats} />
        )}
      </DialogContent>
    </Dialog>
  );
}

function SendEmailsDialogBody({
  onOpenChange,
  stats,
}: Omit<SendEmailsDialogProps, "open">) {
  const [tab, setTab] = useState<EmailsTab>("decision");
  // The send path only knows decision/announcement; the export tab never sends.
  const mode: DecisionEmailMode =
    tab === "announcement" ? "announcement" : "decision";
  const [selected, setSelected] = useState<DecidedStatus[]>([]);
  const [exportSelected, setExportSelected] = useState<ApplicationStatus[]>([]);
  const [resendAll, setResendAll] = useState(false);

  const [emailStats, setEmailStats] = useState<DecisionEmailStats | null>(null);
  const [statsLoading, setStatsLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [downloadingCsv, setDownloadingCsv] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);

  useEffect(() => {
    const controller = new AbortController();

    fetchDecisionEmailStats(controller.signal).then((res) => {
      if (controller.signal.aborted) return;
      if (res.status === 200 && res.data) {
        setEmailStats(res.data.stats);
      } else {
        errorAlert(res);
      }
      setStatsLoading(false);
    });

    return () => controller.abort();
  }, []);

  async function refreshStats() {
    setStatsLoading(true);
    const res = await fetchDecisionEmailStats();
    if (res.status === 200 && res.data) {
      setEmailStats(res.data.stats);
    } else {
      errorAlert(res);
    }
    setStatsLoading(false);
  }

  const countsFor = (status: DecidedStatus) => emailStats?.[status];

  // In decision mode the audience is what's ticked; the announcement always
  // goes to every decided applicant, so its count comes from the server.
  const recipientCount =
    mode === "announcement"
      ? resendAll
        ? (emailStats?.announcement.total ?? 0)
        : (emailStats?.announcement.pending ?? 0)
      : selected.reduce((sum, status) => {
          const counts = countsFor(status);
          if (!counts) return sum;
          return sum + (resendAll ? counts.total : counts.pending);
        }, 0);

  const canSend =
    !statsLoading &&
    recipientCount > 0 &&
    (mode === "announcement" || selected.length > 0);

  function toggleStatus(status: DecidedStatus, checked: boolean) {
    setSelected((prev) =>
      checked ? [...prev, status] : prev.filter((s) => s !== status),
    );
  }

  async function handleSend() {
    setConfirmOpen(false);
    setSending(true);

    const res = await sendDecisionEmails({
      mode,
      statuses: mode === "decision" ? selected : undefined,
      resend_all: resendAll,
    });

    if (res.status === 200 && res.data) {
      const { queued, skipped } = res.data;
      if (queued === 0) {
        toast.info(
          skipped > 0
            ? `Nothing to send — all ${skipped} applicant(s) were already emailed`
            : "Nothing to send — no applicants matched",
        );
      } else {
        toast.success(
          `Sending ${queued} email(s)${skipped > 0 ? `, skipped ${skipped} already emailed` : ""}`,
        );
      }
      await refreshStats();
      onOpenChange(false);
    } else {
      errorAlert(res);
    }

    setSending(false);
  }

  function toggleExportStatus(status: ApplicationStatus, checked: boolean) {
    setExportSelected((prev) =>
      checked ? [...prev, status] : prev.filter((s) => s !== status),
    );
  }

  // "All statuses" convenience: tick the master selector, then untick any row.
  const allExportSelected =
    exportSelected.length === APPLICATION_STATUSES.length;
  function toggleAllExport(checked: boolean) {
    setExportSelected(checked ? [...APPLICATION_STATUSES] : []);
  }

  async function handleExportCsv(exportStatuses: ApplicationStatus[]) {
    if (exportStatuses.length === 0) return;

    setDownloadingCsv(true);
    const results = await Promise.all(exportStatuses.map(fetchApplicantEmails));

    const failed = results.find((res) => res.status !== 200 || !res.data);
    if (failed) {
      errorAlert(failed);
      setDownloadingCsv(false);
      return;
    }

    const rows = results.flatMap((res, i) =>
      (res.data?.applicants ?? []).map(
        (a) =>
          `${csvEscape(a.email)},${csvEscape(a.first_name)},${csvEscape(a.last_name)},${exportStatuses[i]}`,
      ),
    );
    const csv = ["email,first_name,last_name,status", ...rows].join("\n");

    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download =
      exportStatuses.length === APPLICATION_STATUSES.length
        ? "all_applicants.csv"
        : `${exportStatuses.join("_")}_applicants.csv`;
    link.click();
    URL.revokeObjectURL(url);
    setDownloadingCsv(false);
  }

  return (
    <>
      <DialogHeader className="shrink-0 border-b px-6 py-4">
        <DialogTitle className="flex items-center gap-2">
          <Mail className="size-4" />
          Emails
        </DialogTitle>
        <DialogDescription>
          Email applicants their decision, announce that decisions are out
          without revealing them, or export applicant emails as a CSV.
        </DialogDescription>
      </DialogHeader>

      <div className="flex-1 overflow-y-auto px-6 py-4">
        <Tabs value={tab} onValueChange={(value) => setTab(value as EmailsTab)}>
          <TabsList className="w-full">
            <TabsTrigger value="decision" className="cursor-pointer">
              <Mail className="size-3.5" />
              Decision emails
            </TabsTrigger>
            <TabsTrigger value="announcement" className="cursor-pointer">
              <Megaphone className="size-3.5" />
              Decisions are out
            </TabsTrigger>
            <TabsTrigger value="export" className="cursor-pointer">
              <FileDown className="size-3.5" />
              Export
            </TabsTrigger>
          </TabsList>

          <TabsContent value="decision" className="mt-4 space-y-3">
            <p className="text-sm text-muted-foreground">
              Each group gets its own email telling them their result. Pick who
              to send to.
            </p>

            {statsLoading ? (
              <div className="space-y-2">
                {DECIDED_STATUSES.map((status) => (
                  <Skeleton key={status} className="h-16 w-full rounded-md" />
                ))}
              </div>
            ) : (
              DECIDED_STATUSES.map((status) => {
                const counts = countsFor(status);
                const pending = counts?.pending ?? 0;
                const sent = counts?.sent ?? 0;
                const availableCount = resendAll
                  ? (counts?.total ?? 0)
                  : pending;

                return (
                  <div
                    key={status}
                    className="flex items-start gap-3 rounded-md border p-3"
                  >
                    <Checkbox
                      id={`send-${status}`}
                      checked={selected.includes(status)}
                      onCheckedChange={(checked) =>
                        toggleStatus(status, !!checked)
                      }
                      disabled={availableCount === 0}
                      className="mt-0.5 cursor-pointer"
                    />
                    <div className="grid flex-1 gap-1">
                      <div className="flex items-center justify-between">
                        <Label
                          htmlFor={`send-${status}`}
                          className="cursor-pointer text-sm font-medium"
                        >
                          {APPLICATION_STATUS_LABELS[status]}
                        </Label>
                        <Badge
                          variant="secondary"
                          className="text-xs font-light"
                        >
                          {availableCount} to email
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {STATUS_DESCRIPTIONS[status]}
                      </p>
                      {sent > 0 && (
                        <p className="text-xs text-muted-foreground">
                          {sent} already emailed
                          {resendAll ? " (will be re-sent)" : " — skipped"}
                        </p>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </TabsContent>

          <TabsContent value="announcement" className="mt-4 space-y-3">
            <div className="rounded-md border p-4">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium">All decided applicants</p>
                {statsLoading ? (
                  <Skeleton className="h-5 w-20 rounded-full" />
                ) : (
                  <Badge variant="secondary" className="text-xs font-light">
                    {recipientCount} to email
                  </Badge>
                )}
              </div>
              <p className="mt-2 text-xs text-muted-foreground">
                Goes to everyone marked accepted, waitlisted, or rejected. The
                email says decisions are out and links to the portal — it does
                not reveal the outcome. Applicants still in{" "}
                <strong>submitted</strong> are excluded, since they have no
                decision to look up yet.
              </p>
              {!statsLoading && (emailStats?.announcement.sent ?? 0) > 0 && (
                <p className="mt-2 text-xs text-muted-foreground">
                  {emailStats?.announcement.sent} already emailed
                  {resendAll ? " (will be re-sent)" : " — skipped"}
                </p>
              )}
            </div>
          </TabsContent>

          <TabsContent value="export" className="mt-4 space-y-3">
            <p className="text-sm text-muted-foreground">
              Export a CSV of applicant emails, filtered by application status.
              Exports never send anyone an email.
            </p>

            <div className="flex items-center gap-3 rounded-md border p-3">
              <Checkbox
                id="export-all"
                checked={allExportSelected}
                onCheckedChange={(checked) => toggleAllExport(!!checked)}
                className="mt-0.5 cursor-pointer"
              />
              <Label
                htmlFor="export-all"
                className="cursor-pointer text-sm font-medium"
              >
                All statuses
              </Label>
            </div>

            {APPLICATION_STATUSES.map((status) => (
              <div
                key={status}
                className="flex items-center gap-3 rounded-md border p-3"
              >
                <Checkbox
                  id={`export-${status}`}
                  checked={exportSelected.includes(status)}
                  onCheckedChange={(checked) =>
                    toggleExportStatus(status, !!checked)
                  }
                  className="mt-0.5 cursor-pointer"
                />
                <Label
                  htmlFor={`export-${status}`}
                  className="cursor-pointer text-sm font-medium"
                >
                  {APPLICATION_STATUS_LABELS[status]}
                </Label>
              </div>
            ))}

            <div className="pt-1">
              <Button
                variant="outline"
                size="sm"
                className="cursor-pointer font-light"
                disabled={exportSelected.length === 0}
                loading={downloadingCsv}
                onClick={() => handleExportCsv(exportSelected)}
              >
                {!downloadingCsv && <Download className="size-3.5" />}
                {downloadingCsv
                  ? "Generating..."
                  : `Export CSV${exportSelected.length > 0 ? ` — ${exportSelected.length} status${exportSelected.length === 1 ? "" : "s"}` : ""}`}
              </Button>
            </div>
          </TabsContent>
        </Tabs>

        {tab !== "export" && (
          <>
            <div className="mt-4 flex items-start justify-between gap-4 rounded-md border p-3">
              <div className="grid gap-1">
                <Label
                  htmlFor="resend-all"
                  className="cursor-pointer text-sm font-medium"
                >
                  Resend to applicants already emailed
                </Label>
                <p className="text-xs text-muted-foreground">
                  Off by default. Turn this on only if a previous send failed or
                  the wording changed — it emails people a second time.
                </p>
              </div>
              <Switch
                id="resend-all"
                checked={resendAll}
                onCheckedChange={setResendAll}
                className="mt-0.5 cursor-pointer"
              />
            </div>

            {resendAll && (
              <div className="mt-2 flex items-start gap-1.5 rounded-md bg-yellow-50 p-2 text-yellow-800">
                <TriangleAlert className="mt-0.5 size-3.5 shrink-0" />
                <p className="text-xs">
                  Duplicate protection is off — everyone selected will be
                  emailed, including those who already received this email.
                </p>
              </div>
            )}

            {stats && stats.submitted > 0 && (
              <div className="mt-2 flex items-start gap-1.5 rounded-md bg-yellow-50 p-2 text-yellow-800">
                <TriangleAlert className="mt-0.5 size-3.5 shrink-0" />
                <p className="text-xs">
                  {stats.submitted} application(s) are still in submitted status
                  and will not receive anything.
                </p>
              </div>
            )}
          </>
        )}
      </div>

      <DialogFooter className="shrink-0 border-t px-6 py-4 sm:justify-end">
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            className="cursor-pointer font-light"
            onClick={() => onOpenChange(false)}
          >
            {tab === "export" ? "Done" : "Cancel"}
          </Button>
          {tab !== "export" && (
            <Button
              size="sm"
              className="cursor-pointer"
              disabled={!canSend}
              loading={sending}
              onClick={() => setConfirmOpen(true)}
            >
              {sending
                ? "Sending..."
                : `Send to ${recipientCount} applicant${recipientCount === 1 ? "" : "s"}`}
            </Button>
          )}
        </div>
      </DialogFooter>

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Email {recipientCount} applicant
              {recipientCount === 1 ? "" : "s"}?
            </AlertDialogTitle>
            <AlertDialogDescription>
              {mode === "announcement"
                ? "This tells every decided applicant that decisions are out, without saying what their decision is."
                : `This tells ${selected.map((s) => APPLICATION_STATUS_LABELS[s].toLowerCase()).join(", ")} applicants their result.`}{" "}
              Emails cannot be unsent.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="cursor-pointer">
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction onClick={handleSend} className="cursor-pointer">
              Yes, send emails
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
