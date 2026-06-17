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
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleString();
}

export function WalkInQueueTable({ queue }: WalkInQueueTableProps) {
  if (queue.length === 0) {
    return (
      <div className="flex items-center justify-center h-32 text-muted-foreground text-sm">
        No walk-ins in queue.
      </div>
    );
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead className="w-16">#</TableHead>
          <TableHead>Email</TableHead>
          <TableHead>Arrived</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {queue.map((entry) => (
          <TableRow key={entry.id}>
            <TableCell className="font-medium">{entry.position}</TableCell>
            <TableCell>{entry.email}</TableCell>
            <TableCell className="text-muted-foreground text-sm">
              {formatTime(entry.queued_at)}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
