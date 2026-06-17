import { useCallback, useEffect, useRef, useState } from "react";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

import { getWalkInQueue } from "./api";
import { PromoteDialog } from "./components/PromoteDialog";
import { WalkInQueueTable } from "./components/WalkInQueueTable";
import type { WalkInsResponse } from "./types";

const REFRESH_INTERVAL_MS = 30_000;

export default function WalkInQueuePage() {
  const [data, setData] = useState<WalkInsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const abortRef = useRef<AbortController | null>(null);

  const fetchQueue = useCallback(async () => {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setLoading(true);
    const res = await getWalkInQueue(controller.signal);
    if (res.status === 0) return; // aborted
    setData(res.data ?? null);
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchQueue();
    const interval = setInterval(fetchQueue, REFRESH_INTERVAL_MS);
    return () => {
      clearInterval(interval);
      abortRef.current?.abort();
    };
  }, [fetchQueue]);

  const pending = data?.pending ?? 0;
  const total = data?.total ?? 0;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">Walk-In Queue</h1>
          {!loading && (
            <p className="text-sm text-muted-foreground">
              {pending} waiting &middot; {total} total walk-ins
            </p>
          )}
        </div>
        <PromoteDialog pending={pending} onSuccess={fetchQueue} />
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Pending Queue</CardTitle>
          <CardDescription>
            Walk-ins are listed in arrival order. Position 1 is next to be
            promoted.
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          {loading && !data ? (
            <div className="flex items-center justify-center h-32 text-muted-foreground text-sm">
              Loading...
            </div>
          ) : (
            <WalkInQueueTable queue={data?.queue ?? []} />
          )}
        </CardContent>
      </Card>
    </div>
  );
}
