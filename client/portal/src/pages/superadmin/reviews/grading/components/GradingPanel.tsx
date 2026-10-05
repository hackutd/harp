import {
  Check,
  Minus,
  Plane,
  RotateCcw,
  ThumbsDown,
  ThumbsUp,
} from "lucide-react";
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

const TRAVEL_STATUS_LABELS: Record<TravelStatus, string> = {
  not_requested: "Not requested",
  pending: "Pending decision",
  approved: "Approved",
  rejected: "Rejected",
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

function formatTravelAmount(
  cents: number | null | undefined,
  fallback: string,
) {
  if (cents == null) return fallback;

  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 2,
  }).format(cents / 100);
}

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
      {/* Application decision */}
      <section aria-label="Application" className="border-b pb-5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
              Application
            </p>
          </div>
          <Badge className={getStatusColor(listItem.status)}>
            {listItem.status}
          </Badge>
        </div>

        <div className="mt-4">
          <div className="flex items-center justify-between gap-3">
            <p className="text-xs font-medium">Application reviewer votes</p>
            <p className="text-xs text-muted-foreground">
              {listItem.reviews_completed} of {listItem.reviews_assigned}{" "}
              complete
            </p>
          </div>
          <div className="mt-3 grid grid-cols-3 divide-x">
            <div className="flex items-center justify-center gap-2 px-1">
              <ThumbsDown className="h-4 w-4 text-muted-foreground" />
              <div>
                <p className="text-sm font-semibold tabular-nums">
                  {listItem.reject_votes}
                </p>
                <p className="text-[11px] text-muted-foreground">Reject</p>
              </div>
            </div>
            <div className="flex items-center justify-center gap-2 px-1">
              <Minus className="h-4 w-4 text-muted-foreground" />
              <div>
                <p className="text-sm font-semibold tabular-nums">
                  {listItem.waitlist_votes}
                </p>
                <p className="text-[11px] text-muted-foreground">Waitlist</p>
              </div>
            </div>
            <div className="flex items-center justify-center gap-2 px-1">
              <ThumbsUp className="h-4 w-4 text-muted-foreground" />
              <div>
                <p className="text-sm font-semibold tabular-nums">
                  {listItem.accept_votes}
                </p>
                <p className="text-[11px] text-muted-foreground">Accept</p>
              </div>
            </div>
          </div>
          {listItem.ai_percent != null && (
            <div className="mt-3 flex items-center justify-between border-t pt-3 text-xs">
              <span className="text-muted-foreground">AI indicator</span>
              <span className="font-medium tabular-nums">
                {listItem.ai_percent}%
              </span>
            </div>
          )}
        </div>

        <div className="mt-4">
          <GradingActionButtons
            disabled={grading}
            onReject={() => onGrade("rejected")}
            onWaitlist={() => onGrade("waitlisted")}
            onAccept={() => onGrade("accepted")}
            label={null}
            selected={
              listItem.status === "rejected"
                ? "reject"
                : listItem.status === "waitlisted"
                  ? "waitlist"
                  : listItem.status === "accepted"
                    ? "accept"
                    : null
            }
          />
        </div>
      </section>

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
        <section aria-label="Travel reimbursement" className="border-b pb-5">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                Travel · Separate decision
              </p>
            </div>
            <Badge
              className={`${TRAVEL_STATUS_COLORS[listItem.travel_status]} shrink-0 px-2.5 py-1 text-xs`}
            >
              <Plane className="mr-1 h-3.5 w-3.5" />
              {TRAVEL_STATUS_LABELS[listItem.travel_status]}
            </Badge>
          </div>

          <div className="mt-4 grid grid-cols-2 divide-x border-y py-3">
            <div className="pr-3">
              <p className="text-xs text-muted-foreground">
                Requested estimate
              </p>
              <p className="mt-0.5 text-base font-semibold tabular-nums">
                {formatTravelAmount(
                  listItem.estimated_travel_cost_cents,
                  "Not provided",
                )}
              </p>
            </div>
            <div className="pl-3">
              <p className="text-xs text-muted-foreground">Approved amount</p>
              <p className="mt-0.5 text-base font-semibold tabular-nums">
                {formatTravelAmount(
                  listItem.travel_approved_amount_cents,
                  "Not set",
                )}
              </p>
            </div>
          </div>

          <div className="mt-4">
            <p className="text-xs font-medium">Travel reviewer votes</p>
            <div className="mt-3 grid grid-cols-2 divide-x">
              <div className="flex items-center justify-center gap-2 px-1">
                <ThumbsDown className="h-4 w-4 text-muted-foreground" />
                <div>
                  <p className="text-sm font-semibold tabular-nums">
                    {listItem.travel_no_votes}
                  </p>
                  <p className="text-[11px] text-muted-foreground">No</p>
                </div>
              </div>
              <div className="flex items-center justify-center gap-2 px-1">
                <ThumbsUp className="h-4 w-4 text-muted-foreground" />
                <div>
                  <p className="text-sm font-semibold tabular-nums">
                    {listItem.travel_yes_votes}
                  </p>
                  <p className="text-[11px] text-muted-foreground">Yes</p>
                </div>
              </div>
            </div>
          </div>

          {travelDecisionBlocker && (
            <p className="mt-3 rounded-md bg-muted px-3 py-2 text-xs leading-relaxed text-muted-foreground">
              {travelDecisionBlocker}
            </p>
          )}
          <div className="mt-4">
            <div className="grid gap-2 sm:grid-cols-2">
              <Button
                variant="outline"
                aria-pressed={listItem.travel_status === "rejected"}
                className={`w-full cursor-pointer disabled:cursor-not-allowed ${
                  listItem.travel_status === "rejected"
                    ? "border-foreground/40 bg-accent text-accent-foreground shadow-xs"
                    : ""
                }`}
                disabled={
                  grading ||
                  travelDecisionLocked ||
                  listItem.travel_status === "rejected"
                }
                onClick={() => onGradeTravel("rejected")}
              >
                <ThumbsDown className="h-4 w-4" />
                Reject
                {listItem.travel_status === "rejected" && (
                  <Check className="ml-auto h-4 w-4" aria-label="Selected" />
                )}
              </Button>
              <Button
                variant="outline"
                aria-pressed={listItem.travel_status === "approved"}
                className={`w-full cursor-pointer disabled:cursor-not-allowed ${
                  listItem.travel_status === "approved"
                    ? "border-foreground/40 bg-accent text-accent-foreground shadow-xs"
                    : ""
                }`}
                disabled={
                  grading || (travelDecisionLocked && !canEditCurrentApproval)
                }
                onClick={openApproval}
              >
                <ThumbsUp className="h-4 w-4" />
                Approve
                {listItem.travel_status === "approved" && (
                  <Check className="ml-auto h-4 w-4" aria-label="Selected" />
                )}
              </Button>
            </div>
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
            <AlertDialogContent className="gap-5">
              <AlertDialogHeader>
                <AlertDialogTitle>
                  {listItem.travel_status === "approved"
                    ? "Edit approved travel amount"
                    : "Set approved travel amount"}
                </AlertDialogTitle>
                <AlertDialogDescription>
                  Set the most the organization will reimburse this person. The
                  requested estimate will stay unchanged.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-3 rounded-lg bg-muted/50 p-3">
                  <div>
                    <p className="text-xs text-muted-foreground">Requested</p>
                    <p className="mt-1 font-medium tabular-nums">
                      {formatTravelAmount(
                        listItem.estimated_travel_cost_cents,
                        "Not provided",
                      )}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">
                      Currently approved
                    </p>
                    <p className="mt-1 font-medium tabular-nums">
                      {formatTravelAmount(
                        listItem.travel_approved_amount_cents,
                        "Not set",
                      )}
                    </p>
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between gap-3">
                    <Label htmlFor="travel-approved-amount">
                      Approved amount
                    </Label>
                    {(listItem.estimated_travel_cost_cents ?? 0) > 0 && (
                      <Button
                        type="button"
                        variant="link"
                        size="sm"
                        className="h-auto px-0 text-xs font-normal"
                        onClick={() => {
                          setApprovalAmount(
                            (
                              listItem.estimated_travel_cost_cents! / 100
                            ).toFixed(2),
                          );
                          setApprovalError(null);
                        }}
                      >
                        Use requested amount
                      </Button>
                    )}
                  </div>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-base text-muted-foreground">
                      $
                    </span>
                    <Input
                      id="travel-approved-amount"
                      aria-describedby={
                        approvalError
                          ? "travel-approved-amount-help travel-approved-amount-error"
                          : "travel-approved-amount-help"
                      }
                      aria-invalid={!!approvalError}
                      autoFocus
                      type="number"
                      inputMode="decimal"
                      min="0.01"
                      step="0.01"
                      value={approvalAmount}
                      onChange={(event) => {
                        setApprovalAmount(event.target.value);
                        setApprovalError(null);
                      }}
                      className="h-11 pl-7 pr-14 text-base tabular-nums"
                      placeholder="0.00"
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-medium text-muted-foreground">
                      USD
                    </span>
                  </div>
                  <p
                    id="travel-approved-amount-help"
                    className="text-xs text-muted-foreground"
                  >
                    You can approve less than the requested estimate.
                  </p>
                  {approvalError && (
                    <p
                      id="travel-approved-amount-error"
                      className="text-sm text-destructive"
                      role="alert"
                    >
                      {approvalError}
                    </p>
                  )}
                </div>
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
                  {listItem.travel_status === "approved"
                    ? "Save approved amount"
                    : "Approve & save amount"}
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
        </section>
      )}

      {/* Reviewer Notes */}
      <ReviewerNotesList notes={notes} loading={notesLoading} />
    </div>
  );
});
