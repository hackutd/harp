import { IconBolt } from "@tabler/icons-react";

import { Badge } from "@/components/ui/badge";

import { isPriorityApplication, PRIORITY_DEADLINE } from "./priority";

interface PriorityBadgeProps {
  submittedAt: string | null | undefined;
  className?: string;
}

/** Renders nothing unless the application was submitted by PRIORITY_DEADLINE. */
export function PriorityBadge({ submittedAt, className }: PriorityBadgeProps) {
  if (!isPriorityApplication(submittedAt)) return null;
  return (
    <Badge
      variant="purple"
      className={className}
      title={`Submitted by ${PRIORITY_DEADLINE.toLocaleString("en-US", {
        timeZone: "America/Chicago",
        dateStyle: "medium",
        timeStyle: "short",
      })} CT`}
    >
      <IconBolt />
      Priority
    </Badge>
  );
}
