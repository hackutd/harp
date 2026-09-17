import { Trash2 } from "lucide-react";
import { useCallback, useState } from "react";
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
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { resetHackathon } from "@/pages/superadmin/settings/api";
import { getLocalTimeZoneLabel } from "@/shared/lib/datetime";
import { useUserStore } from "@/shared/stores";

import { fetchScheduleItems } from "../api";

type ScheduleHeaderCardProps = {
  loading: boolean;
  schedulingEnabled: boolean;
  configuredStartDate: string | null;
  configuredEndDate: string | null;
  scheduleDaysLength: number;
  onScheduleCleared: () => void;
};

export function ScheduleHeaderCard({
  loading,
  schedulingEnabled,
  configuredStartDate,
  configuredEndDate,
  scheduleDaysLength,
  onScheduleCleared,
}: ScheduleHeaderCardProps) {
  const [jsonPopoverOpen, setJsonPopoverOpen] = useState(false);
  const [loadingJsonResponse, setLoadingJsonResponse] = useState(false);
  const [jsonResponse, setJsonResponse] = useState("");
  const [jsonError, setJsonError] = useState<string | null>(null);
  const [eventCount, setEventCount] = useState(0);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [clearing, setClearing] = useState(false);

  // The reset endpoint is super admin only, so admins would only get a 403.
  const isSuperAdmin = useUserStore((s) => s.user?.role === "super_admin");

  const loadJsonResponse = useCallback(async () => {
    setLoadingJsonResponse(true);
    setJsonError(null);

    // public.go delegates /v1/public/schedule to listScheduleHandler.
    const response = await fetchScheduleItems();

    if (response.status === 200 && response.data) {
      setJsonResponse(
        JSON.stringify({ data: { schedule: response.data.schedule } }, null, 2),
      );
      setEventCount(response.data.schedule.length);
      setJsonError(null);
    } else {
      setJsonResponse("");
      setEventCount(0);
      setJsonError(response.error ?? "Failed to fetch schedule response.");
    }

    setLoadingJsonResponse(false);
  }, []);

  const handleJsonPopoverOpenChange = useCallback(
    (open: boolean) => {
      setJsonPopoverOpen(open);

      if (open) {
        void loadJsonResponse();
      }
    },
    [loadJsonResponse],
  );

  // The confirm dialog is portaled outside the popover, so opening it counts as
  // an outside interaction — close the popover first instead of fighting it.
  const openClearConfirm = useCallback(() => {
    setJsonPopoverOpen(false);
    setConfirmOpen(true);
  }, []);

  const handleClearSchedule = useCallback(async () => {
    setClearing(true);

    const res = await resetHackathon({ reset_schedule: true });

    if (res.error) {
      toast.error(`Failed to clear the schedule: ${res.error}`);
    } else {
      setJsonResponse("");
      setEventCount(0);
      onScheduleCleared();
      toast.success("Schedule cleared.");
      setConfirmOpen(false);
    }

    setClearing(false);
  }, [onScheduleCleared]);

  const timeZoneLabel = getLocalTimeZoneLabel().label;

  return (
    <Card>
      <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-1">
          <CardTitle className="font-medium text-md">
            Public Schedule API
          </CardTitle>
          <CardDescription>
            Route: <code>GET /v1/public/schedule</code>
          </CardDescription>
        </div>
        <Popover
          open={jsonPopoverOpen}
          onOpenChange={handleJsonPopoverOpenChange}
        >
          <PopoverTrigger asChild>
            <Button variant="outline" size="sm" type="button">
              Show JSON Response
            </Button>
          </PopoverTrigger>
          <PopoverContent align="end" className="w-[min(90vw,640px)] p-3">
            <div className="space-y-2">
              <div className="flex items-center justify-between gap-2">
                <p className="text-xs text-muted-foreground">
                  <code>GET /v1/public/schedule</code>
                  {!loadingJsonResponse && !jsonError ? (
                    <>
                      {" · "}
                      {eventCount} event{eventCount === 1 ? "" : "s"}
                    </>
                  ) : null}
                </p>
                {isSuperAdmin ? (
                  <Button
                    variant="ghost"
                    size="sm"
                    type="button"
                    onClick={openClearConfirm}
                    disabled={loadingJsonResponse || eventCount === 0}
                    className="h-7 px-2 text-destructive hover:bg-destructive/10 hover:text-destructive"
                  >
                    <Trash2 className="mr-1 size-3.5" />
                    Clear All
                  </Button>
                ) : null}
              </div>
              {loadingJsonResponse ? (
                <p className="text-sm text-muted-foreground">
                  Loading JSON response...
                </p>
              ) : jsonError ? (
                <p className="text-sm text-destructive">{jsonError}</p>
              ) : (
                <pre className="max-h-80 overflow-auto rounded-md bg-muted p-3 text-xs">
                  {jsonResponse}
                </pre>
              )}
              {isSuperAdmin ? (
                <p className="text-xs text-muted-foreground">
                  Events created under a previous date range still show up here.
                  Clearing removes every event, including those outside the
                  current range.
                </p>
              ) : null}
            </div>
          </PopoverContent>
        </Popover>
      </CardHeader>
      <CardContent>
        {loading ? (
          <p className="text-sm text-muted-foreground">
            Loading schedule data...
          </p>
        ) : schedulingEnabled ? (
          <p className="text-sm text-muted-foreground">
            Showing {scheduleDaysLength} day
            {scheduleDaysLength === 1 ? "" : "s"} for {configuredStartDate} to{" "}
            {configuredEndDate}. Times shown in{" "}
            <span className="font-semibold">{timeZoneLabel}</span>.
          </p>
        ) : (
          <p className="text-sm text-destructive">
            Hackathon date range is not configured. Ask a Super Admin to set
            start and end dates in Settings.
          </p>
        )}
      </CardContent>

      <AlertDialog
        open={confirmOpen}
        onOpenChange={(open) => !clearing && setConfirmOpen(open)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Clear the entire schedule?</AlertDialogTitle>
            <AlertDialogDescription>
              This permanently deletes all {eventCount} schedule event
              {eventCount === 1 ? "" : "s"} — including any left over from a
              previous date range — along with the notifications attached to
              them. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="cursor-pointer" disabled={clearing}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              className="cursor-pointer bg-destructive text-white hover:bg-destructive/90"
              disabled={clearing}
              onClick={(event) => {
                // Keep the dialog mounted until the request resolves.
                event.preventDefault();
                void handleClearSchedule();
              }}
            >
              {clearing ? "Clearing..." : "Clear Schedule"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}
