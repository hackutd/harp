import { Maximize2 } from "lucide-react";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

import type { ReviewTab } from "../store";
import type { Review } from "../types";
import { VoteBadge } from "./VoteBadge";

interface ReviewsTableProps {
  reviews: Review[];
  loading: boolean;
  selectedId: string | null;
  onSelectReview: (id: string) => void;
  variant: ReviewTab;
}

<<<<<<<< HEAD:client/web/src/pages/admin/assigned/components/ReviewsTable.tsx
function formatName(firstName: string | null, lastName: string | null) {
  if (!firstName && !lastName) return "-";
  return `${firstName ?? ""} ${lastName ?? ""}`.trim();
}

export function ReviewsTable({
========
const CONFIG = {
  assigned: {
    voteHeader: "Vote",
    dateHeader: "Assigned At",
    dateField: "assigned_at" as const,
    emptyText: "No pending reviews",
  },
  completed: {
    voteHeader: "Decision",
    dateHeader: "Reviewed At",
    dateField: "reviewed_at" as const,
    emptyText: "No completed reviews",
  },
};

export const ReviewsTable = memo(function ReviewsTable({
>>>>>>>> 605e2e03 (feat: centralize assign and completed ui):client/web/src/pages/admin/reviews/components/ReviewsTable.tsx
  reviews,
  loading,
  selectedId,
  onSelectReview,
  variant,
}: ReviewsTableProps) {
  const { voteHeader, dateHeader, dateField, emptyText } = CONFIG[variant];

  return (
    <div className="relative overflow-auto h-full p-6 pt-0">
      {loading && (
        <div className="absolute inset-0 bg-white/50 z-10 animate-pulse" />
      )}
      <Table className="border-collapse [&_th]:border-r [&_th]:border-gray-200 [&_td]:border-r [&_td]:border-gray-200 [&_th:last-child]:border-r-0 [&_td:last-child]:border-r-0">
        <TableHeader className="sticky top-0 bg-card z-10">
          <TableRow>
            <TableHead>{voteHeader}</TableHead>
            <TableHead>Name</TableHead>
            <TableHead>Email</TableHead>
            <TableHead>Age</TableHead>
            <TableHead>University</TableHead>
            <TableHead>Major</TableHead>
            <TableHead>Country</TableHead>
            <TableHead>Hackathons</TableHead>
            <TableHead>{dateHeader}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {reviews.length === 0 ? (
            <TableRow>
              <TableCell colSpan={9} className="text-center text-gray-500">
                {emptyText}
              </TableCell>
            </TableRow>
          ) : (
            reviews.map((review) => (
              <TableRow
                key={review.id}
                className={`group cursor-pointer hover:bg-muted/50 [&>td]:py-3 ${selectedId === review.id ? "bg-muted/50" : ""}`}
                onClick={() => onSelectReview(review.id)}
              >
                <TableCell>
                  <VoteBadge vote={review.vote} />
                </TableCell>
                <TableCell className="whitespace-nowrap">
                  <div className="flex items-center justify-between gap-4">
                    <span>
                      {formatName(review.first_name, review.last_name)}
                    </span>
                    <Maximize2 className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                  </div>
                </TableCell>
                <TableCell>{review.email}</TableCell>
                <TableCell>{review.age ?? "-"}</TableCell>
                <TableCell>{review.university ?? "-"}</TableCell>
                <TableCell>{review.major ?? "-"}</TableCell>
                <TableCell>{review.country_of_residence ?? "-"}</TableCell>
                <TableCell>{review.hackathons_attended_count ?? "-"}</TableCell>
                <TableCell className="whitespace-nowrap">
                  {review[dateField]
                    ? new Date(review[dateField]!).toLocaleDateString()
                    : "-"}
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </div>
  );
}
