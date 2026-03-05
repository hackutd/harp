import { useCallback, useState } from "react";

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

import { fetchScheduleItems } from "../api";

type ScheduleHeaderCardProps = {
  loading: boolean;
  schedulingEnabled: boolean;
  configuredStartDate: string | null;
  configuredEndDate: string | null;
  scheduleDaysLength: number;
};

export function ScheduleHeaderCard({
  loading,
  schedulingEnabled,
  configuredStartDate,
  configuredEndDate,
  scheduleDaysLength,
}: ScheduleHeaderCardProps) {
  const [jsonPopoverOpen, setJsonPopoverOpen] = useState(false);
  const [loadingJsonResponse, setLoadingJsonResponse] = useState(false);
  const [jsonResponse, setJsonResponse] = useState("");
  const [jsonError, setJsonError] = useState<string | null>(null);

  const loadJsonResponse = useCallback(async () => {
    setLoadingJsonResponse(true);
    setJsonError(null);

    // public.go delegates /v1/public/schedule to listScheduleHandler.
    const response = await fetchScheduleItems();

    if (response.status === 200 && response.data) {
      setJsonResponse(
        JSON.stringify({ data: { schedule: response.data.schedule } }, null, 2),
      );
      setJsonError(null);
    } else {
      setJsonResponse("");
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
              <p className="text-xs text-muted-foreground">
                <code>GET /v1/public/schedule</code>
              </p>
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
            {configuredEndDate} (America/Chicago).
          </p>
        ) : (
          <p className="text-sm text-destructive">
            Hackathon date range is not configured. Ask a Super Admin to set
            start and end dates in Settings.
          </p>
        )}
      </CardContent>
    </Card>
  );
}
