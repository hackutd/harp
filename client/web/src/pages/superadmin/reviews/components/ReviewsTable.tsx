import { ArrowDown, ChevronsUpDown, Maximize2 } from "lucide-react";
import { memo } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type {
  ApplicationListItem,
  ApplicationSortBy,
} from "@/pages/admin/all-applicants/types";
import { formatName, getStatusColor } from "@/pages/admin/all-applicants/utils";

interface ReviewsTableProps {
  applications: ApplicationListItem[];
  loading: boolean;
  selectedId: string | null;
  onSelectApplication: (id: string) => void;
  sortBy: ApplicationSortBy;
  onSortChange: (sortBy: ApplicationSortBy) => void;
}

type SortableColumn = Exclude<ApplicationSortBy, "created_at">;

const SORTABLE_COLUMNS: { key: SortableColumn; label: string }[] = [
  { key: "accept_votes", label: "Accept" },
  { key: "reject_votes", label: "Reject" },
  { key: "waitlist_votes", label: "Waitlist" },
];

export const ReviewsTable = memo(function ReviewsTable({
  applications,
  loading,
  selectedId,
  onSelectApplication,
  sortBy,
  onSortChange,
}: ReviewsTableProps) {
  function handleSortClick(column: SortableColumn) {
    if (sortBy === column) {
      onSortChange("created_at");
    } else {
      onSortChange(column);
    }
  }

  return (
    <div className="relative overflow-auto h-full p-6 pt-0">
      {loading && (
        <div className="absolute inset-0 bg-white/50 z-10 animate-pulse" />
      )}
      <Table className="border-collapse [&_th]:border-r [&_th]:border-gray-200 [&_td]:border-r [&_td]:border-gray-200 [&_th:last-child]:border-r-0 [&_td:last-child]:border-r-0">
        <TableHeader className="sticky top-0 bg-card z-10">
          <TableRow>
            <TableHead>Status</TableHead>
            <TableHead>Name</TableHead>
            <TableHead>Email</TableHead>
            {SORTABLE_COLUMNS.map((col) => (
              <TableHead key={col.key} className="p-0">
                <Button
                  variant="ghost"
                  className="w-full justify-start gap-1 rounded-none font-medium cursor-pointer"
                  onClick={() => handleSortClick(col.key)}
                >
                  {col.label}
                  {sortBy === col.key ? (
                    <ArrowDown className="size-3.5" />
                  ) : (
                    <ChevronsUpDown className="size-3.5" />
                  )}
                </Button>
              </TableHead>
            ))}
            <TableHead>Reviews</TableHead>
            <TableHead>AI %</TableHead>
            <TableHead>Submitted</TableHead>
            <TableHead>Created</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {applications.length === 0 ? (
            <TableRow>
              <TableCell colSpan={10} className="text-center text-gray-500">
                No applications found
              </TableCell>
            </TableRow>
          ) : (
            applications.map((app) => (
              <TableRow
                key={app.id}
                className={`group cursor-pointer hover:bg-muted/50 [&>td]:py-3 ${selectedId === app.id ? "bg-muted/50" : ""}`}
                onClick={() => onSelectApplication(app.id)}
              >
                <TableCell>
                  <Badge className={getStatusColor(app.status)}>
                    {app.status}
                  </Badge>
                </TableCell>
                <TableCell className="whitespace-nowrap">
                  <div className="flex items-center justify-between gap-4">
                    <span>{formatName(app.first_name, app.last_name)}</span>
                    <Maximize2 className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                  </div>
                </TableCell>
                <TableCell>{app.email}</TableCell>
                <TableCell className="text-center">
                  {app.accept_votes}
                </TableCell>
                <TableCell className="text-center">
                  {app.reject_votes}
                </TableCell>
                <TableCell className="text-center">
                  {app.waitlist_votes}
                </TableCell>
                <TableCell className="text-center whitespace-nowrap">
                  {app.reviews_completed}/{app.reviews_assigned}
                </TableCell>
                <TableCell>
                  {app.ai_percent != null ? `${app.ai_percent}%` : "-"}
                </TableCell>
                <TableCell className="whitespace-nowrap">
                  {app.submitted_at
                    ? new Date(app.submitted_at).toLocaleDateString()
                    : "-"}
                </TableCell>
                <TableCell className="whitespace-nowrap">
                  {new Date(app.created_at).toLocaleDateString()}
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </div>
  );
});
