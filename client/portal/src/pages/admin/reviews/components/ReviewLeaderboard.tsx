import { Medal, Trophy } from "lucide-react";
import { memo } from "react";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/shared/lib/utils";

import type { ReviewerStats } from "../types";

interface ReviewLeaderboardProps {
  reviewers: ReviewerStats[];
  loading: boolean;
  currentUserId: string | undefined;
}

// Only reviewers who have actually completed something get a trophy or medal,
// so a board where nobody has started does not crown everyone at rank 1.
function RankBadge({ rank, completed }: { rank: number; completed: number }) {
  const Icon =
    completed > 0 && rank === 1
      ? Trophy
      : completed > 0 && rank <= 3
        ? Medal
        : null;
  return (
    <span className="flex items-center gap-1.5 tabular-nums">
      {Icon ? (
        <Icon
          className={cn(
            "size-4",
            rank === 1 ? "text-primary" : "text-muted-foreground",
          )}
          aria-hidden
        />
      ) : (
        <span className="size-4" aria-hidden />
      )}
      {rank}
    </span>
  );
}

export const ReviewLeaderboard = memo(function ReviewLeaderboard({
  reviewers,
  loading,
  currentUserId,
}: ReviewLeaderboardProps) {
  return (
    <div className="relative overflow-auto h-full p-6 pt-0">
      {loading && (
        <div className="absolute inset-0 bg-background/50 z-10 animate-pulse" />
      )}
      <Table className="border-collapse [&_th]:border-r [&_th]:border-gray-200 [&_td]:border-r [&_td]:border-gray-200 [&_th:last-child]:border-r-0 [&_td:last-child]:border-r-0">
        <TableHeader className="sticky top-0 bg-card z-10">
          <TableRow>
            <TableHead className="w-20">Rank</TableHead>
            <TableHead>Reviewer</TableHead>
            <TableHead className="text-right">Completed</TableHead>
            <TableHead className="text-right">Pending</TableHead>
            <TableHead>Last Review</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {reviewers.length === 0 ? (
            <TableRow>
              <TableCell
                colSpan={5}
                className="text-center text-muted-foreground"
              >
                No reviewers found
              </TableCell>
            </TableRow>
          ) : (
            reviewers.map((reviewer) => {
              const name =
                `${reviewer.first_name ?? ""} ${reviewer.last_name ?? ""}`.trim();
              const hasName = name !== "";
              const isMe = reviewer.admin_id === currentUserId;
              return (
                <TableRow
                  key={reviewer.admin_id}
                  data-state={isMe ? "selected" : undefined}
                  className="[&>td]:py-3"
                >
                  <TableCell>
                    <RankBadge
                      rank={reviewer.rank}
                      completed={reviewer.completed}
                    />
                  </TableCell>
                  <TableCell>
                    <div className="flex min-w-0 items-center gap-2">
                      <Avatar className="size-7">
                        {reviewer.profile_picture_url ? (
                          <AvatarImage
                            src={reviewer.profile_picture_url}
                            alt={hasName ? name : reviewer.email}
                          />
                        ) : null}
                        <AvatarFallback className="bg-muted text-xs">
                          {(hasName ? name : reviewer.email)
                            .charAt(0)
                            .toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <div className="min-w-0">
                        <p className="flex items-center gap-2 truncate">
                          <span className="truncate">
                            {hasName ? name : reviewer.email}
                          </span>
                          {isMe && <Badge variant="secondary">You</Badge>}
                        </p>
                        {hasName && (
                          <p className="truncate text-xs text-muted-foreground">
                            {reviewer.email}
                          </p>
                        )}
                      </div>
                    </div>
                  </TableCell>
                  <TableCell className="text-right font-medium tabular-nums">
                    {reviewer.completed}
                  </TableCell>
                  <TableCell className="text-right text-muted-foreground tabular-nums">
                    {reviewer.pending}
                  </TableCell>
                  <TableCell className="whitespace-nowrap">
                    {reviewer.last_reviewed_at
                      ? new Date(reviewer.last_reviewed_at).toLocaleDateString()
                      : "-"}
                  </TableCell>
                </TableRow>
              );
            })
          )}
        </TableBody>
      </Table>
    </div>
  );
});
