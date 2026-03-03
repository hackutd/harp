import {
  Loader2,
  MessageSquare,
  Minus,
  ThumbsDown,
  ThumbsUp,
} from "lucide-react";
import { memo } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
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
        </div>
      </div>

      {/* Reviewer Notes */}
      <div>
        <div className="flex items-center gap-1.5 mb-2.5">
          <MessageSquare className="h-4 w-4 text-muted-foreground" />
          <Label className="text-sm text-muted-foreground">
            Reviewer Notes ({notes.length})
          </Label>
        </div>
        {notesLoading ? (
          <div className="text-xs text-muted-foreground">Loading notes...</div>
        ) : notes.length > 0 ? (
          <div className="space-y-2.5">
            {notes.map((note, idx) => (
              <div
                key={`${note.admin_id}-${idx}`}
                className="bg-white border rounded-md p-3 text-sm"
              >
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-sm font-medium text-muted-foreground">
                    {note.admin_email}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {new Date(note.created_at).toLocaleDateString()}
                  </span>
                </div>
                <p className="text-sm leading-relaxed whitespace-pre-wrap">
                  {note.notes}
                </p>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-xs text-muted-foreground italic">
            No reviewer notes
          </p>
        )}
      </div>

      {/* Grade Applicant */}
      <div>
        <Label className="text-xs text-muted-foreground">Grade Applicant</Label>
        <div className="flex flex-col gap-2 mt-2">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="outline"
                className="w-full cursor-pointer hover:bg-red-50 hover:text-red-700 hover:border-red-300 disabled:opacity-50 disabled:cursor-not-allowed"
                onClick={() => onGrade("rejected")}
                disabled={grading}
              >
                {grading ? (
                  <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />
                ) : (
                  <ThumbsDown className="h-4 w-4 mr-1.5" />
                )}
                Reject
                <kbd className="ml-auto px-1.5 py-0.5 bg-muted rounded text-[10px] font-mono text-muted-foreground">
                  ⌘J
                </kbd>
              </Button>
            </TooltipTrigger>
            <TooltipContent>Reject (⌘J)</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="outline"
                className="w-full cursor-pointer hover:bg-yellow-50 hover:text-yellow-700 hover:border-yellow-300 disabled:opacity-50 disabled:cursor-not-allowed"
                onClick={() => onGrade("waitlisted")}
                disabled={grading}
              >
                {grading ? (
                  <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />
                ) : (
                  <Minus className="h-4 w-4 mr-1.5" />
                )}
                Waitlist
                <kbd className="ml-auto px-1.5 py-0.5 bg-muted rounded text-[10px] font-mono text-muted-foreground">
                  ⌘K
                </kbd>
              </Button>
            </TooltipTrigger>
            <TooltipContent>Waitlist (⌘K)</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="outline"
                className="w-full cursor-pointer hover:bg-green-50 hover:text-green-700 hover:border-green-300 disabled:opacity-50 disabled:cursor-not-allowed"
                onClick={() => onGrade("accepted")}
                disabled={grading}
              >
                {grading ? (
                  <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />
                ) : (
                  <ThumbsUp className="h-4 w-4 mr-1.5" />
                )}
                Accept
                <kbd className="ml-auto px-1.5 py-0.5 bg-muted rounded text-[10px] font-mono text-muted-foreground">
                  ⌘L
                </kbd>
              </Button>
            </TooltipTrigger>
            <TooltipContent>Accept (⌘L)</TooltipContent>
          </Tooltip>
        </div>
      </div>
    </div>
  );
});
