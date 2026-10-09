import { IconBolt } from "@tabler/icons-react";

import { Badge } from "@/components/ui/badge";

import { isPriorityApplication, usePriorityDeadline } from "./priority";

interface PriorityBadgeProps {
  submittedAt: string | null | undefined;
  className?: string;
}

/** Renders nothing unless the application was submitted by the priority deadline. */
export function PriorityBadge({ submittedAt, className }: PriorityBadgeProps) {
  const deadline = usePriorityDeadline();
  if (!deadline || !isPriorityApplication(submittedAt, deadline)) return null;
  return (
    <Badge
      variant="purple"
      className={className}
      title={`Submitted by ${deadline.toLocaleString("en-US", {
        dateStyle: "medium",
        timeStyle: "short",
      })}`}
    >
      <IconBolt />
      Priority
    </Badge>
  );
}
