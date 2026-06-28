import { useState } from "react";

import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

import type { WalkIn } from "../types";

const PAGE_SIZE = 20;

interface WalkInQueueTableProps {
  queue: WalkIn[];
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleString();
}

export function WalkInQueueTable({ queue }: WalkInQueueTableProps) {
  const [page, setPage] = useState(0);

  if (queue.length === 0) {
    return (
      <div className="flex items-center justify-center h-32 text-muted-foreground text-sm">
        No walk-ins in queue.
      </div>
    );
  }

  const totalPages = Math.ceil(queue.length / PAGE_SIZE);
  const start = page * PAGE_SIZE;
  const paginated = queue.slice(start, start + PAGE_SIZE);

  return (
    <div className="flex flex-col px-4 py-2">
      <div className="overflow-y-auto max-h-[520px] rounded-md border">
        <Table className="border-collapse">
          <TableHeader className="sticky top-0 bg-background z-10">
            <TableRow className="border-b">
              <TableHead className="w-16 text-left px-4 py-3 border-r">
                #
              </TableHead>
              <TableHead className="text-left px-4 py-3 border-r">
                Email
              </TableHead>
              <TableHead className="text-left px-4 py-3">Arrived</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {paginated.map((entry) => (
              <TableRow key={entry.id} className="border-b last:border-0">
                <TableCell className="text-left font-semibold tabular-nums text-foreground px-4 py-3 border-r">
                  {entry.position}
                </TableCell>
                <TableCell className="font-medium px-4 py-3 border-r">
                  {entry.email}
                </TableCell>
                <TableCell className="text-left text-muted-foreground text-sm tabular-nums px-4 py-3">
                  {formatTime(entry.queued_at)}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <div className="flex items-center justify-between px-1 py-3 text-sm text-muted-foreground">
        <span>
          {start + 1}–{Math.min(start + PAGE_SIZE, queue.length)} of{" "}
          {queue.length}
        </span>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setPage((p) => p - 1)}
            disabled={page === 0}
          >
            Previous
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setPage((p) => p + 1)}
            disabled={page >= totalPages - 1}
          >
            Next
          </Button>
        </div>
      </div>
    </div>
  );
}
