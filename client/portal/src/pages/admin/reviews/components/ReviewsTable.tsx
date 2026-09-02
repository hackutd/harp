import { Maximize2 } from "lucide-react";
import { memo } from "react";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatName } from "@/pages/admin/all-applicants/utils";
import { useRedactApplicants } from "@/shared/hooks";
import { formatApplicantLabel, maskEmail } from "@/shared/lib/redaction";

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
  reviews,
  loading,
  selectedId,
  onSelectReview,
  variant,
}: ReviewsTableProps) {
  const { voteHeader, dateHeader, dateField, emptyText } = CONFIG[variant];
  const redact = useRedactApplicants();

  return (
    <div className="relative overflow-auto h-full p-6 pt-0">
      {loading && (
        <div className="absolute inset-0 bg-white/50 z-10 animate-pulse" />
      )}
      <Table className="border-collapse [&_th]:border-r [&_th]:border-gray-200 [&_td]:border-r [&_td]:border-gray-200 [&_th:last-child]:border-r-0 [&_td:last-child]:border-r-0">
        <TableHeader className="sticky top-0 bg-card z-10">
          <TableRow>
            <TableHead>{voteHeader}</TableHead>
            <TableHead>{redact ? "Applicant" : "Name"}</TableHead>
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
                data-state={selectedId === review.id ? "selected" : undefined}
                className="group cursor-pointer hover:bg-muted [&>td]:py-3"
                onClick={() => onSelectReview(review.id)}
              >
                <TableCell className="relative">
                  <VoteBadge vote={review.vote} />
                  <span className="absolute left-2 top-1/2 z-10 -translate-y-1/2 rounded-md p-1 opacity-0 backdrop-blur-sm transition-opacity group-hover:opacity-100">
                    <Maximize2 className="h-4 w-4 text-muted-foreground" />
                  </span>
                </TableCell>
                <TableCell className="whitespace-nowrap">
                  {redact
                    ? formatApplicantLabel(review.application_id)
                    : formatName(review.first_name, review.last_name)}
                </TableCell>
                <TableCell>
                  {redact ? maskEmail(review.email) : review.email}
                </TableCell>
                <TableCell>{review.age ?? "-"}</TableCell>
                <TableCell>{review.university ?? "-"}</TableCell>
                <TableCell>{review.major ?? "-"}</TableCell>
                <TableCell>{review.country_of_residence ?? "-"}</TableCell>
                <TableCell>{review.hackathons_attended ?? "-"}</TableCell>
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
});
