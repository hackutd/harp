import { Badge } from "@/components/ui/badge";

import type { ReviewVote } from "../types";

interface VoteBadgeProps {
  vote: ReviewVote | null;
}

export function VoteBadge({ vote }: VoteBadgeProps) {
  switch (vote) {
    case "accept":
      return <Badge variant="green">Accept</Badge>;
    case "waitlist":
      return <Badge variant="orange">Waitlist</Badge>;
    case "reject":
      return <Badge variant="red">Reject</Badge>;
    default:
      return <Badge variant="neutral">Pending</Badge>;
  }
}
