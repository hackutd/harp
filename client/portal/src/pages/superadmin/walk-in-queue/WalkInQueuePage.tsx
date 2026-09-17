import { ChevronLeft, ChevronRight } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
} from "@/components/ui/card";

import { getWalkInQueue } from "./api";
import { PromoteDialog } from "./components/PromoteDialog";
import { WalkInQueueTable } from "./components/WalkInQueueTable";
import type { WalkInsResponse } from "./types";

const REFRESH_INTERVAL_MS = 30_000;
const PAGE_SIZE = 20;

export default function WalkInQueuePage() {
  const [data, setData] = useState<WalkInsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(0);
  const abortRef = useRef<AbortController | null>(null);

  // Used by PromoteDialog's onSuccess — never called directly in an effect body.
  const refresh = useCallback(() => {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    void getWalkInQueue(controller.signal).then((res) => {
      if (res.status === 0) return;
      setData(res.data ?? null);
    });
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    abortRef.current = controller;

    void getWalkInQueue(controller.signal).then((res) => {
      if (res.status === 0) return;
      setData(res.data ?? null);
      setLoading(false);
    });

    const interval = setInterval(refresh, REFRESH_INTERVAL_MS);
    return () => {
      clearInterval(interval);
      controller.abort();
    };
  }, [refresh]);

  const pending = data?.pending ?? 0;
  const total = data?.total ?? 0;
  const queue = data?.queue ?? [];

  const totalPages = Math.max(1, Math.ceil(queue.length / PAGE_SIZE));
  // Clamp in case the queue shrank (auto-refresh) while on a later page.
  const safePage = Math.min(page, totalPages - 1);
  const start = safePage * PAGE_SIZE;
  const visible = queue.slice(start, start + PAGE_SIZE);

  return (
    <div className="flex flex-col gap-3 h-full min-h-0">
      <Card className="flex-1 flex flex-col gap-3 min-h-0 overflow-hidden">
        <CardHeader className="shrink-0">
          <div className="flex items-center justify-between gap-2">
            <CardDescription className="font-light flex flex-wrap items-center gap-1.5">
              <span>Walk-ins in arrival order &mdash; position 1 is next</span>
              <Badge className="text-xs font-light bg-yellow-100 text-yellow-800">
                {pending} waiting
              </Badge>
              <Badge className="text-xs font-light bg-green-100 text-green-800">
                {total - pending} promoted
              </Badge>
              <Badge className="text-xs font-light bg-gray-100 text-gray-800">
                {total} total
              </Badge>
              {queue.length > PAGE_SIZE && (
                <span>
                  showing {start + 1}&ndash;
                  {Math.min(start + PAGE_SIZE, queue.length)} of {queue.length}
                </span>
              )}
            </CardDescription>
            <div className="flex items-center gap-2">
              <PromoteDialog pending={pending} onSuccess={refresh} />
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="cursor-pointer font-light"
                  onClick={() => setPage(safePage - 1)}
                  disabled={safePage === 0}
                >
                  <ChevronLeft className="size-4 mr-1" />
                  Prev
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="cursor-pointer font-light"
                  onClick={() => setPage(safePage + 1)}
                  disabled={safePage >= totalPages - 1}
                >
                  Next
                  <ChevronRight className="size-4 ml-1" />
                </Button>
              </div>
            </div>
          </div>
        </CardHeader>
        <hr className="border-border" />
        <CardContent className="p-0 flex-1 overflow-hidden">
          <WalkInQueueTable queue={visible} loading={loading && !data} />
        </CardContent>
      </Card>
    </div>
  );
}
