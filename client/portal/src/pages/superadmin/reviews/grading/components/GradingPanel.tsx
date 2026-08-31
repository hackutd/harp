import { Minus, Plane, ThumbsDown, ThumbsUp } from "lucide-react";
import { memo } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  GradingActionButtons,
  ReviewerNotesList,
} from "@/pages/admin/_shared/grading";
import type { ApplicationListItem } from "@/pages/admin/all-applicants/types";
import { getStatusColor } from "@/pages/admin/all-applicants/utils";
import type { ReviewNote } from "@/pages/admin/reviews/types";
import type { TravelStatus } from "@/types";

const TRAVEL_STATUS_COLORS: Record<TravelStatus, string> = {
  not_requested: "bg-gray-100 text-gray-800",
  pending: "bg-blue-100 text-blue-800",
  approved: "bg-green-100 text-green-800",
  rejected: "bg-red-100 text-red-800",
};

interface GradingPanelProps {
  listItem: ApplicationListItem | null;
  notes: ReviewNote[];
  notesLoading: boolean;
  grading: boolean;
  onGrade: (status: "accepted" | "rejected" | "waitlisted") => void;
  onGradeTravel: (travelStatus: "approved" | "rejected" | "pending") => void;
}

export const GradingPanel = memo(function GradingPanel({
  listItem,
  notes,
  notesLoading,
  grading,
  onGrade,
  onGradeTravel,
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

      {/* Travel Reimbursement — only when the applicant requested it */}
      {listItem.travel_status !== "not_requested" && (
        <div>
          <Label className="text-xs text-muted-foreground">
            Travel Reimbursement
          </Label>
          <div className="flex items-center gap-2 flex-wrap mt-1.5">
            <Badge
              className={`${TRAVEL_STATUS_COLORS[listItem.travel_status]} text-sm px-2.5 py-1`}
            >
              <Plane className="h-3.5 w-3.5 mr-1" />
              {listItem.travel_status}
            </Badge>
            <Badge className="bg-green-100 text-green-800 text-sm px-2.5 py-1">
              <ThumbsUp className="h-3.5 w-3.5 mr-1" />
              {listItem.travel_yes_votes} yes
            </Badge>
            <Badge className="bg-red-100 text-red-800 text-sm px-2.5 py-1">
              <ThumbsDown className="h-3.5 w-3.5 mr-1" />
              {listItem.travel_no_votes} no
            </Badge>
          </div>
          <div className="flex gap-2 mt-2">
            <Button
              size="sm"
              variant="outline"
              className="flex-1 cursor-pointer text-red-700 hover:text-red-800 hover:bg-red-50"
              disabled={grading || listItem.travel_status === "rejected"}
              onClick={() => onGradeTravel("rejected")}
            >
              <ThumbsDown className="h-3.5 w-3.5 mr-1" />
              Reject Travel
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="flex-1 cursor-pointer text-green-700 hover:text-green-800 hover:bg-green-50"
              disabled={grading || listItem.travel_status === "approved"}
              onClick={() => onGradeTravel("approved")}
            >
              <ThumbsUp className="h-3.5 w-3.5 mr-1" />
              Approve Travel
            </Button>
          </div>
          {listItem.travel_status !== "pending" && (
            <Button
              size="sm"
              variant="ghost"
              className="w-full mt-1.5 cursor-pointer text-muted-foreground"
              disabled={grading}
              onClick={() => onGradeTravel("pending")}
            >
              Reset to pending
            </Button>
          )}
        </div>
      )}

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
