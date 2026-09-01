import { Badge } from "@/components/ui/badge";

import type { ReviewVote } from "../types";

interface VoteBadgeProps {
  vote: ReviewVote | null;
}

export function VoteBadge({ vote }: VoteBadgeProps) {
  switch (vote) {
    case "accept":
      return <Badge className="bg-green-100 text-green-800">Accept</Badge>;
    case "waitlist":
      return <Badge className="bg-yellow-100 text-yellow-800">Waitlist</Badge>;
    case "reject":
      return <Badge className="bg-red-100 text-red-800">Reject</Badge>;
    default:
      return (
        <Badge variant="outline" className="text-muted-foreground">
          Pending
        </Badge>
      );
  }
}
