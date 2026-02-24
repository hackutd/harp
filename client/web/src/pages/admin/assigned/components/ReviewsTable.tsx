import { Maximize2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

import type { Review, ReviewVote } from "../types";
import { VoteBadge } from "./VoteBadge";

interface ReviewsTableProps {
  reviews: Review[];
  selectedId: string | null;
  loading: boolean;
  onSelectReview: (id: string) => void;
  getVote: (
    reviewId: string,
    serverVote: ReviewVote | null,
  ) => ReviewVote | null;
}

function formatName(firstName: string | null, lastName: string | null) {
  if (!firstName && !lastName) return "-";
  return `${firstName ?? ""} ${lastName ?? ""}`.trim();
}

export function ReviewsTable({
  reviews,
  selectedId,
  loading,
  onSelectReview,
  getVote,
}: ReviewsTableProps) {
  return (
    <div className="relative overflow-auto h-full p-6 pt-0">
      {loading && (
        <div className="absolute inset-0 bg-white/50 flex items-center justify-center z-10">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
        </div>
      )}
      <Table className="border-collapse [&_th]:border-r [&_th]:border-gray-200 [&_td]:border-r [&_td]:border-gray-200 [&_th:last-child]:border-r-0 [&_td:last-child]:border-r-0">
        <TableHeader className="sticky top-0 bg-card z-10">
          <TableRow>
            <TableHead>Vote</TableHead>
            <TableHead>Name</TableHead>
            <TableHead>Email</TableHead>
            <TableHead>Age</TableHead>
            <TableHead>University</TableHead>
            <TableHead>Major</TableHead>
            <TableHead>Country</TableHead>
            <TableHead>Hackathons</TableHead>
            <TableHead>Assigned At</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {reviews.length === 0 ? (
            <TableRow>
              <TableCell colSpan={9} className="text-center text-gray-500">
                No pending reviews
              </TableCell>
            </TableRow>
          ) : (
            reviews.map((review) => {
              const vote = getVote(review.id, review.vote);
              return (
                <TableRow
                  key={review.id}
                  className={`group hover:bg-muted/50 [&>td]:py-3 cursor-pointer ${
                    selectedId === review.id ? "bg-muted/50" : ""
                  }`}
                  onClick={() => onSelectReview(review.id)}
                >
                  <TableCell>
                    <VoteBadge vote={vote} />
                  </TableCell>
                  <TableCell className="whitespace-nowrap">
                    <div className="flex items-center justify-between gap-4">
                      <span>
                        {formatName(review.first_name, review.last_name)}
                      </span>
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        className="opacity-0 cursor-pointer group-hover:opacity-100 transition-opacity h-6 w-6"
                        onClick={(e) => {
                          e.stopPropagation();
                          onSelectReview(review.id);
                        }}
                      >
                        <Maximize2 className="h-4 w-4 text-muted-foreground" />
                      </Button>
                    </div>
                  </TableCell>
                  <TableCell>{review.email}</TableCell>
                  <TableCell>{review.age ?? "-"}</TableCell>
                  <TableCell>{review.university ?? "-"}</TableCell>
                  <TableCell>{review.major ?? "-"}</TableCell>
                  <TableCell>{review.country_of_residence ?? "-"}</TableCell>
                  <TableCell>
                    {review.hackathons_attended_count ?? "-"}
                  </TableCell>
                  <TableCell className="whitespace-nowrap">
                    {new Date(review.assigned_at).toLocaleDateString()}
                  </TableCell>
                </TableRow>
              );
            })
          )}
        </TableBody>
      </Table>
    </div>
  );
}
