import { Zap } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { cn } from "@/shared/lib/utils";

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
      className={cn("bg-purple-100 text-purple-800", className)}
      title={`Submitted by ${PRIORITY_DEADLINE.toLocaleString("en-US", {
        timeZone: "America/Chicago",
        dateStyle: "medium",
        timeStyle: "short",
      })} CT`}
    >
      <Zap />
      Priority
    </Badge>
  );
}
