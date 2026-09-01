import { Minus, Plane, RotateCcw, ThumbsDown, ThumbsUp } from "lucide-react";
import { memo, useState } from "react";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  GradingActionButtons,
  ReviewerNotesList,
} from "@/pages/admin/_shared/grading";
import type { ApplicationListItem } from "@/pages/admin/all-applicants/types";
import { getStatusColor } from "@/pages/admin/all-applicants/utils";
import type { ReviewNote } from "@/pages/admin/reviews/types";
import type { RSVPStatus, TravelStatus } from "@/types";

const TRAVEL_STATUS_COLORS: Record<TravelStatus, string> = {
  not_requested: "bg-gray-100 text-gray-800",
  pending: "bg-blue-100 text-blue-800",
  approved: "bg-green-100 text-green-800",
  rejected: "bg-red-100 text-red-800",
};

const RSVP_STATUS_COLORS: Record<RSVPStatus, string> = {
  pending: "bg-gray-100 text-gray-800",
  confirmed: "bg-green-100 text-green-800",
  declined: "bg-yellow-100 text-yellow-800",
};

const RSVP_STATUS_LABELS: Record<RSVPStatus, string> = {
  pending: "not answered",
  confirmed: "spot claimed",
  declined: "spot declined",
};

/**
 * Resets discard what the hacker submitted and cannot be undone, so each one
 * goes through a dialog that spells out what is lost.
 */
function ConfirmResetButton({
  label,
  title,
  description,
  disabled,
  onConfirm,
}: {
  label: string;
  title: string;
  description: string;
  disabled: boolean;
  onConfirm: () => void;
}) {
  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button
          size="sm"
          variant="ghost"
          className="w-full mt-1.5 cursor-pointer text-muted-foreground"
          disabled={disabled}
        >
          <RotateCcw className="h-3.5 w-3.5 mr-1" />
          {label}
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription>{description}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel className="cursor-pointer">
            Cancel
          </AlertDialogCancel>
          <AlertDialogAction className="cursor-pointer" onClick={onConfirm}>
            {label}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

interface GradingPanelProps {
  listItem: ApplicationListItem | null;
  notes: ReviewNote[];
  notesLoading: boolean;
  grading: boolean;
  onGrade: (status: "accepted" | "rejected" | "waitlisted") => void;
  onGradeTravel: (
    travelStatus: "approved" | "rejected" | "pending",
    approvedAmountCents?: number,
  ) => void;
  onResetRSVP: () => void;
  onResetTravelRSVP: () => void;
}

export const GradingPanel = memo(function GradingPanel({
  listItem,
  notes,
  notesLoading,
  grading,
  onGrade,
  onGradeTravel,
  onResetRSVP,
  onResetTravelRSVP,
}: GradingPanelProps) {
  const [approvalOpen, setApprovalOpen] = useState(false);
  const [approvalAmount, setApprovalAmount] = useState("");
  const [approvalError, setApprovalError] = useState<string | null>(null);

  if (!listItem) return null;

  const openApproval = () => {
    setApprovalAmount(
      listItem.travel_approved_amount_cents
        ? (listItem.travel_approved_amount_cents / 100).toFixed(2)
        : listItem.estimated_travel_cost_cents
          ? (listItem.estimated_travel_cost_cents / 100).toFixed(2)
          : "",
    );
    setApprovalError(null);
    setApprovalOpen(true);
  };

  const confirmApproval = () => {
    const dollars = Number(approvalAmount);
    if (!Number.isFinite(dollars) || dollars <= 0) {
      setApprovalError("Enter an approved amount greater than $0.");
      return;
    }
    onGradeTravel("approved", Math.round(dollars * 100));
    setApprovalOpen(false);
  };

  // The backend refuses both of these, so say why instead of letting the
  // super admin click into a 409.
  const travelRSVPSubmitted = listItem.travel_rsvp_status !== "pending";
  const travelDecisionLocked =
    travelRSVPSubmitted || listItem.status === "rejected";
  const travelDecisionBlocker = travelRSVPSubmitted
    ? "The hacker already submitted their travel form. Reset it below to change the travel decision."
    : listItem.status === "rejected"
      ? "Travel cannot be decided on a rejected application."
      : null;
  const canEditCurrentApproval =
    listItem.travel_status === "approved" && listItem.status !== "rejected";

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

      {/* RSVP — one-shot, so a mistaken decline needs a reset to undo */}
      {(listItem.status === "accepted" ||
        listItem.rsvp_status !== "pending") && (
        <div>
          <Label className="text-xs text-muted-foreground">RSVP</Label>
          <div className="mt-1.5">
            <Badge
              className={`${RSVP_STATUS_COLORS[listItem.rsvp_status]} text-sm px-2.5 py-1`}
            >
              {RSVP_STATUS_LABELS[listItem.rsvp_status]}
            </Badge>
          </div>
          {listItem.rsvp_status !== "pending" && (
            <ConfirmResetButton
              label="Reset RSVP"
              title="Reset this hacker's RSVP?"
              description="They will be able to claim or decline their spot again. Their travel form answers and uploaded receipts are cleared with it, since those only exist under a claimed spot. This cannot be undone."
              disabled={grading}
              onConfirm={onResetRSVP}
            />
          )}
        </div>
      )}

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
            {listItem.travel_approved_amount_cents != null && (
              <Badge variant="outline" className="text-sm px-2.5 py-1">
                ${(listItem.travel_approved_amount_cents / 100).toFixed(2)}
                approved
              </Badge>
            )}
            <Badge className="bg-green-100 text-green-800 text-sm px-2.5 py-1">
              <ThumbsUp className="h-3.5 w-3.5 mr-1" />
              {listItem.travel_yes_votes} yes
            </Badge>
            <Badge className="bg-red-100 text-red-800 text-sm px-2.5 py-1">
              <ThumbsDown className="h-3.5 w-3.5 mr-1" />
              {listItem.travel_no_votes} no
            </Badge>
          </div>
          {travelDecisionBlocker && (
            <p className="text-xs text-muted-foreground mt-2">
              {travelDecisionBlocker}
            </p>
          )}
          <div className="flex gap-2 mt-2">
            <Button
              size="sm"
              variant="outline"
              className="flex-1 cursor-pointer text-red-700 hover:text-red-800 hover:bg-red-50"
              disabled={
                grading ||
                travelDecisionLocked ||
                listItem.travel_status === "rejected"
              }
              onClick={() => onGradeTravel("rejected")}
            >
              <ThumbsDown className="h-3.5 w-3.5 mr-1" />
              Reject Travel
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="flex-1 cursor-pointer text-green-700 hover:text-green-800 hover:bg-green-50"
              disabled={
                grading || (travelDecisionLocked && !canEditCurrentApproval)
              }
              onClick={openApproval}
            >
              <ThumbsUp className="h-3.5 w-3.5 mr-1" />
              {listItem.travel_status === "approved"
                ? "Edit Amount"
                : "Approve Travel"}
            </Button>
          </div>
          {listItem.travel_status !== "pending" && (
            <Button
              size="sm"
              variant="ghost"
              className="w-full mt-1.5 cursor-pointer text-muted-foreground"
              disabled={grading || travelDecisionLocked}
              onClick={() => onGradeTravel("pending")}
            >
              Reset to pending
            </Button>
          )}

          <AlertDialog open={approvalOpen} onOpenChange={setApprovalOpen}>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>
                  Approve travel reimbursement
                </AlertDialogTitle>
                <AlertDialogDescription>
                  Set the maximum amount the organization is committing to this
                  person. This can be lower than the amount they requested.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <div className="space-y-2 py-1">
                {listItem.estimated_travel_cost_cents != null && (
                  <p className="text-sm text-muted-foreground">
                    Requested estimate: ${" "}
                    {(listItem.estimated_travel_cost_cents / 100).toFixed(2)}
                  </p>
                )}
                <Label htmlFor="travel-approved-amount">
                  Approved amount (USD)
                </Label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
                    $
                  </span>
                  <Input
                    id="travel-approved-amount"
                    autoFocus
                    type="number"
                    min="0.01"
                    step="0.01"
                    value={approvalAmount}
                    onChange={(event) => {
                      setApprovalAmount(event.target.value);
                      setApprovalError(null);
                    }}
                    className="pl-7"
                    placeholder="0.00"
                  />
                </div>
                {approvalError && (
                  <p className="text-sm text-destructive">{approvalError}</p>
                )}
              </div>
              <AlertDialogFooter>
                <AlertDialogCancel className="cursor-pointer">
                  Cancel
                </AlertDialogCancel>
                <AlertDialogAction
                  className="cursor-pointer bg-green-700 hover:bg-green-800"
                  onClick={(event) => {
                    event.preventDefault();
                    confirmApproval();
                  }}
                >
                  Approve amount
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
          {listItem.travel_rsvp_status !== "pending" && (
            <ConfirmResetButton
              label="Reset travel form"
              title="Reset this hacker's travel form?"
              description="Their submitted travel details are cleared and their uploaded receipts are deleted, so they can fill the form in again — and the travel decision becomes editable. This cannot be undone."
              disabled={grading}
              onConfirm={onResetTravelRSVP}
            />
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
