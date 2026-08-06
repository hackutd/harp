import { memo } from "react";

import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

import type { WalkIn } from "../types";

interface WalkInQueueTableProps {
  queue: WalkIn[];
  loading: boolean;
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export const WalkInQueueTable = memo(function WalkInQueueTable({
  queue,
  loading,
}: WalkInQueueTableProps) {
  return (
    <div className="relative overflow-auto h-full p-6 pt-0">
      <Table className="border-collapse [&_th]:border-r [&_th]:border-gray-200 [&_td]:border-r [&_td]:border-gray-200 [&_th:last-child]:border-r-0 [&_td:last-child]:border-r-0">
        <TableHeader className="sticky top-0 bg-card z-10">
          <TableRow>
            <TableHead className="w-16">#</TableHead>
            <TableHead>Email</TableHead>
            <TableHead>Arrived</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {loading ? (
            [...Array(6)].map((_, i) => (
              <TableRow key={i} className="[&>td]:py-3">
                <TableCell className="w-16">
                  <Skeleton className="h-4 w-6" />
                </TableCell>
                <TableCell>
                  <Skeleton className="h-4 w-48" />
                </TableCell>
                <TableCell>
                  <Skeleton className="h-4 w-28" />
                </TableCell>
              </TableRow>
            ))
          ) : queue.length === 0 ? (
            <TableRow>
              <TableCell
                colSpan={3}
                className="text-center text-muted-foreground h-24"
              >
                No walk-ins in queue
              </TableCell>
            </TableRow>
          ) : (
            queue.map((entry) => (
              <TableRow
                key={entry.id}
                className="hover:bg-muted/50 [&>td]:py-3"
              >
                <TableCell className="w-16 tabular-nums text-muted-foreground">
                  {entry.position}
                </TableCell>
                <TableCell className="truncate">{entry.email}</TableCell>
                <TableCell className="tabular-nums text-muted-foreground">
                  {formatTime(entry.queued_at)}
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </div>
  );
});
