import { Minus, ThumbsDown, ThumbsUp } from "lucide-react";
import { memo } from "react";

import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import {
  GradingActionButtons,
  ReviewerNotesList,
} from "@/pages/admin/_shared/grading";
import type { ApplicationListItem } from "@/pages/admin/all-applicants/types";
import { getStatusColor } from "@/pages/admin/all-applicants/utils";
import type { ReviewNote } from "@/pages/admin/assigned/types";

interface GradingPanelProps {
  listItem: ApplicationListItem | null;
  notes: ReviewNote[];
  notesLoading: boolean;
  grading: boolean;
  onGrade: (status: "accepted" | "rejected" | "waitlisted") => void;
}

export const GradingPanel = memo(function GradingPanel({
  listItem,
  notes,
  notesLoading,
  grading,
  onGrade,
}: GradingPanelProps) {
  if (!listItem) return null;

  return (
    <div className="space-y-4 p-4">
      {/* Current Status */}
      <div>
        <Label className="text-xs text-muted-foreground">Current Status</Label>
        <div className="mt-1">
          <Badge className={getStatusColor(listItem.status)}>
            {listItem.status}
          </Badge>
        </div>
      </div>

      {/* Vote Summary */}
      <div>
        <Label className="text-xs text-muted-foreground">Vote Summary</Label>
        <p className="text-sm mt-1">
          {listItem.reviews_completed} / {listItem.reviews_assigned} reviews
          completed
        </p>
        <div className="flex items-center gap-2 flex-wrap mt-1.5">
          <Badge className="bg-green-100 text-green-800 text-sm px-2.5 py-1">
            <ThumbsUp className="h-3.5 w-3.5 mr-1" />
            {listItem.accept_votes}
          </Badge>
          <Badge className="bg-red-100 text-red-800 text-sm px-2.5 py-1">
            <ThumbsDown className="h-3.5 w-3.5 mr-1" />
            {listItem.reject_votes}
          </Badge>
          <Badge className="bg-yellow-100 text-yellow-800 text-sm px-2.5 py-1">
            <Minus className="h-3.5 w-3.5 mr-1" />
            {listItem.waitlist_votes}
          </Badge>
          {listItem.ai_percent != null && (
            <Badge variant="secondary" className="text-sm px-2.5 py-1">
              AI: {listItem.ai_percent}%
            </Badge>
          )}
        </div>
      </div>

      {/* Reviewer Notes */}
      <ReviewerNotesList notes={notes} loading={notesLoading} />

      {/* Grade Applicant */}
      <GradingActionButtons
        disabled={grading}
        onReject={() => onGrade("rejected")}
        onWaitlist={() => onGrade("waitlisted")}
        onAccept={() => onGrade("accepted")}
        label="Grade Applicant"
      />
    </div>
  );
});
