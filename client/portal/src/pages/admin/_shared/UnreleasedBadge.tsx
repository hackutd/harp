import { Badge } from "@/components/ui/badge";
import type { ApplicationStatus } from "@/types";

const DECIDED: ApplicationStatus[] = ["accepted", "waitlisted", "rejected"];

/**
 * What the hacker sees when it differs from the current status, or null when
 * they see the current decision (or there is no decision yet).
 */
function unreleasedSummary(
  status: ApplicationStatus,
  releasedStatus: ApplicationStatus | null | undefined,
): string | null {
  if (releasedStatus) {
    return releasedStatus === status
      ? null
      : `The hacker still sees ${releasedStatus}. Release decisions to show ${status}.`;
  }
  return DECIDED.includes(status)
    ? `The hacker still sees their application as under review. Release decisions to show ${status}.`
    : null;
}

interface UnreleasedBadgeProps {
  status: ApplicationStatus;
  releasedStatus: ApplicationStatus | null | undefined;
  className?: string;
}

/** Marks a decision the hacker cannot see yet; renders nothing otherwise. */
export function UnreleasedBadge({
  status,
  releasedStatus,
  className,
}: UnreleasedBadgeProps) {
  const summary = unreleasedSummary(status, releasedStatus);
  if (!summary) return null;
  return (
    <Badge
      variant="outline"
      className={className ?? "font-light text-muted-foreground"}
      title={summary}
    >
      Unreleased
    </Badge>
  );
}
