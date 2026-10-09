import {
  IconArrowDown,
  IconArrowsMaximize,
  IconSelector,
} from "@tabler/icons-react";
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
import { PriorityBadge, UnreleasedBadge } from "@/pages/admin/_shared";
import type {
  ApplicationListItem,
  ApplicationSortBy,
} from "@/pages/admin/all-applicants/types";
import { formatName, getStatusColor } from "@/pages/admin/all-applicants/utils";
import { aiOnlyScore, formatAIScore } from "@/shared/lib/ai-assessment";

interface ReviewsTableProps {
  reviewsPerApp: number | null;
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
  { key: "travel_yes_votes", label: "Travel Y/N" },
];

export const ReviewsTable = memo(function ReviewsTable({
  reviewsPerApp,
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
        <div className="absolute inset-0 bg-background/50 z-10 animate-pulse" />
      )}
      <Table className="border-collapse [&_th]:border-r [&_th]:border-border [&_td]:border-r [&_td]:border-border [&_th:last-child]:border-r-0 [&_td:last-child]:border-r-0">
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
                    <IconArrowDown className="size-3.5" />
                  ) : (
                    <IconSelector className="size-3.5" />
                  )}
                </Button>
              </TableHead>
            ))}
            <TableHead>Travel</TableHead>
            <TableHead>Reviews</TableHead>
            <TableHead>AI score</TableHead>
            <TableHead>Submitted</TableHead>
            <TableHead>Created</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {applications.length === 0 ? (
            <TableRow>
              <TableCell
                colSpan={12}
                className="text-center text-muted-foreground"
              >
                No applications found
              </TableCell>
            </TableRow>
          ) : (
            applications.map((app) => (
              <TableRow
                key={app.id}
                data-state={selectedId === app.id ? "selected" : undefined}
                className="group cursor-pointer hover:bg-muted [&>td]:py-3"
                onClick={() => onSelectApplication(app.id)}
              >
                <TableCell className="relative">
                  <div className="flex items-center gap-1.5">
                    <Badge className={getStatusColor(app.status)}>
                      {app.status}
                    </Badge>
                    <PriorityBadge submittedAt={app.submitted_at} />
                    <UnreleasedBadge
                      status={app.status}
                      releasedStatus={app.released_status}
                    />
                  </div>
                  <span className="absolute left-2 top-1/2 z-10 -translate-y-1/2 rounded-md p-1 opacity-0 backdrop-blur-sm transition-opacity group-hover:opacity-100">
                    <IconArrowsMaximize className="h-4 w-4 text-muted-foreground" />
                  </span>
                </TableCell>
                <TableCell className="whitespace-nowrap">
                  {formatName(app.first_name, app.last_name, app.email)}
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
                <TableCell className="text-center">
                  {app.travel_status === "not_requested"
                    ? "-"
                    : `${app.travel_yes_votes}/${app.travel_no_votes}`}
                </TableCell>
                <TableCell className="text-center whitespace-nowrap">
                  {app.travel_status === "not_requested" ? (
                    "-"
                  ) : (
                    <Badge
                      variant={
                        app.travel_status === "approved"
                          ? "green"
                          : app.travel_status === "rejected"
                            ? "red"
                            : "blue"
                      }
                    >
                      {app.travel_status}
                    </Badge>
                  )}
                </TableCell>
                <TableCell className="text-center whitespace-nowrap">
                  <div>
                    {app.reviews_completed} completed · {app.reviews_assigned}{" "}
                    assigned
                  </div>
                  {app.status === "submitted" && reviewsPerApp !== null && (
                    <div className="text-xs text-muted-foreground">
                      Target {reviewsPerApp}
                      {app.reviews_assigned < reviewsPerApp &&
                        ` · ${reviewsPerApp - app.reviews_assigned} assignment${reviewsPerApp - app.reviews_assigned === 1 ? "" : "s"} missing`}
                    </div>
                  )}
                </TableCell>
                <TableCell>
                  {aiOnlyScore(app) != null
                    ? formatAIScore(aiOnlyScore(app))
                    : "-"}
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
