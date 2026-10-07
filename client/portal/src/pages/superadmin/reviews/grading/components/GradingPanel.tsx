import { Pencil, RotateCcw, ThumbsDown, ThumbsUp } from "lucide-react";
import { memo, type ReactNode, useState } from "react";

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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  GradingActionButtons,
  ReviewerNotesList,
  SECTION_TITLE,
  SectionHeader,
  SELECTED_BUTTON,
} from "@/pages/admin/_shared/grading";
import type { ApplicationListItem } from "@/pages/admin/all-applicants/types";
import { getStatusColor } from "@/pages/admin/all-applicants/utils";
import type { ReviewNote } from "@/pages/admin/reviews/types";
import { formatAIScore } from "@/shared/lib/ai-assessment";
import { cn } from "@/shared/lib/utils";
import type { ApplicationStatus, RSVPStatus, TravelStatus } from "@/types";

const STATUS_OPTIONS: { value: ApplicationStatus; label: string }[] = [
  { value: "draft", label: "Draft (editable)" },
  { value: "submitted", label: "Submitted" },
  { value: "accepted", label: "Accepted" },
  { value: "waitlisted", label: "Waitlisted" },
  { value: "rejected", label: "Rejected" },
];

const TRAVEL_STATUS_LABELS: Record<TravelStatus, string> = {
  not_requested: "Not requested",
  pending: "Pending",
  approved: "Approved",
  rejected: "Rejected",
};

const RSVP_STATUS_LABELS: Record<RSVPStatus, string> = {
  pending: "Not answered",
  confirmed: "Spot claimed",
  declined: "Spot declined",
};

/** Full-bleed row of figures, ruled above and below and between columns. */
function StatStrip({
  items,
  className,
}: {
  items: { label: string; value: ReactNode; hint?: string }[];
  className?: string;
}) {
  return (
    <div
      className={cn(
        "grid divide-x border-y",
        items.length === 3 ? "grid-cols-3" : "grid-cols-2",
        className,
      )}
    >
      {items.map((item) => {
        const cell = (
          <div
            key={item.label}
            className={cn("px-3 py-4 text-center", item.hint && "cursor-help")}
          >
            <p className="text-lg font-light tabular-nums">{item.value}</p>
            <p className="mt-0.5 text-xs text-muted-foreground">{item.label}</p>
          </div>
        );
        if (!item.hint) return cell;
        return (
          <Tooltip key={item.label}>
            <TooltipTrigger asChild>{cell}</TooltipTrigger>
            <TooltipContent>{item.hint}</TooltipContent>
          </Tooltip>
        );
      })}
    </div>
  );
}

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
          className="-ml-2 cursor-pointer font-normal text-muted-foreground"
          disabled={disabled}
        >
          <RotateCcw className="h-3.5 w-3.5" />
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
  onGrade: (status: ApplicationStatus) => void;
  onEdit: () => void;
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
  onEdit,
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
    <div className="divide-y">
      {/* Reviewer votes — application and travel together */}
      <section aria-label="Reviewer votes">
        <SectionHeader
          title="Reviewer votes"
          aside={
            <>
              {listItem.reviews_completed} of {listItem.reviews_assigned}{" "}
              complete
              {listItem.ai_score != null && (
                <span className="ml-3 border px-3.5 py-1.5 text-base text-foreground">
                  AI {formatAIScore(listItem.ai_score)}
                </span>
              )}
            </>
          }
        />
        <StatStrip
          className={cn(
            listItem.travel_status === "not_requested" && "border-b-0",
          )}
          items={[
            {
              label: "Reject",
              value: listItem.reject_votes,
              hint: "Reviewer votes",
            },
            {
              label: "Waitlist",
              value: listItem.waitlist_votes,
              hint: "Reviewer votes",
            },
            {
              label: "Accept",
              value: listItem.accept_votes,
              hint: "Reviewer votes",
            },
          ]}
        />
        {listItem.travel_status !== "not_requested" && (
          <StatStrip
            className="border-y-0"
            items={[
              {
                label: "Travel no",
                value: listItem.travel_no_votes,
                hint: "Reviewer travel votes",
              },
              {
                label: "Travel yes",
                value: listItem.travel_yes_votes,
                hint: "Reviewer travel votes",
              },
            ]}
          />
        )}
      </section>

      {/* Application decision — the super admin's call, not a vote */}
      <section aria-label="Decision">
        <SectionHeader
          title="Application decision"
          aside={
            <Badge
              className={cn(
                "px-2.5 py-0.5 text-xs font-normal capitalize",
                getStatusColor(listItem.status),
              )}
            >
              {listItem.status}
            </Badge>
          }
          ruled
        />
        <div className="space-y-4 px-5 py-5">
          <GradingActionButtons
            layout="row"
            intent="decision"
            label={null}
            disabled={grading}
            onReject={() => onGrade("rejected")}
            onWaitlist={() => onGrade("waitlisted")}
            onAccept={() => onGrade("accepted")}
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

          <div className="space-y-2">
            {/* Full override: any status, including reopening as a draft */}
            <div className="flex items-center justify-between gap-3">
              <Label
                htmlFor="grading-status-override"
                className="text-sm font-normal text-muted-foreground"
              >
                Status
              </Label>
              <Select
                value={listItem.status}
                disabled={grading}
                onValueChange={(value) => {
                  if (value !== listItem.status) {
                    onGrade(value as ApplicationStatus);
                  }
                }}
              >
                <SelectTrigger
                  id="grading-status-override"
                  size="sm"
                  className="w-40 cursor-pointer shadow-none"
                >
                  <SelectValue />
                </SelectTrigger>
                <SelectContent align="end">
                  {STATUS_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center justify-between gap-3">
              <span className="text-sm text-muted-foreground">
                Answers & resume
              </span>
              <Button
                variant="outline"
                size="sm"
                className="w-40 cursor-pointer justify-start font-normal shadow-none"
                disabled={grading}
                onClick={onEdit}
              >
                <Pencil className="h-3.5 w-3.5" />
                Edit
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* Travel decision — only when the applicant requested it */}
      {listItem.travel_status !== "not_requested" && (
        <section aria-label="Travel decision">
          <SectionHeader
            title="Travel decision"
            aside={TRAVEL_STATUS_LABELS[listItem.travel_status]}
          />
          <StatStrip
            items={[
              {
                label: "Requested",
                value: formatTravelAmount(
                  listItem.estimated_travel_cost_cents,
                  "—",
                ),
                hint: "Hacker's estimate",
              },
              {
                label: "Approved",
                value: formatTravelAmount(
                  listItem.travel_approved_amount_cents,
                  "—",
                ),
                hint: "Max reimbursement",
              },
            ]}
          />

          <div className="space-y-3 px-5 py-5">
            {travelDecisionBlocker && (
              <p className="text-xs leading-relaxed text-muted-foreground">
                {travelDecisionBlocker}
              </p>
            )}
            <div className="grid grid-cols-2 gap-2">
              <Button
                variant="outline"
                aria-pressed={listItem.travel_status === "rejected"}
                className={cn(
                  "w-full cursor-pointer font-normal shadow-none disabled:cursor-not-allowed",
                  listItem.travel_status === "rejected" && SELECTED_BUTTON,
                )}
                disabled={
                  grading ||
                  travelDecisionLocked ||
                  listItem.travel_status === "rejected"
                }
                onClick={() => onGradeTravel("rejected")}
              >
                <ThumbsDown className="h-4 w-4" />
                Reject
              </Button>
              <Button
                variant="outline"
                aria-pressed={listItem.travel_status === "approved"}
                className={cn(
                  "w-full cursor-pointer font-normal shadow-none disabled:cursor-not-allowed",
                  listItem.travel_status === "approved" && SELECTED_BUTTON,
                )}
                disabled={
                  grading || (travelDecisionLocked && !canEditCurrentApproval)
                }
                onClick={openApproval}
              >
                <ThumbsUp className="h-4 w-4" />
                {listItem.travel_status === "approved"
                  ? "Edit amount"
                  : "Approve"}
              </Button>
            </div>
            {(listItem.travel_status !== "pending" ||
              listItem.travel_rsvp_status !== "pending") && (
              <div className="flex flex-wrap gap-x-2">
                {listItem.travel_status !== "pending" && (
                  <Button
                    size="sm"
                    variant="ghost"
                    className="-ml-2 cursor-pointer font-normal text-muted-foreground"
                    disabled={grading || travelDecisionLocked}
                    onClick={() => onGradeTravel("pending")}
                  >
                    <RotateCcw className="h-3.5 w-3.5" />
                    Reset to pending
                  </Button>
                )}
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

            <AlertDialog open={approvalOpen} onOpenChange={setApprovalOpen}>
              <AlertDialogContent className="gap-5">
                <AlertDialogHeader>
                  <AlertDialogTitle>
                    {listItem.travel_status === "approved"
                      ? "Edit approved travel amount"
                      : "Set approved travel amount"}
                  </AlertDialogTitle>
                  <AlertDialogDescription>
                    Set the most the organization will reimburse this person.
                    The requested estimate will stay unchanged.
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
          </div>
        </section>
      )}

      {/* RSVP — one-shot, so a mistaken decline needs a reset to undo */}
      {(listItem.status === "accepted" ||
        listItem.rsvp_status !== "pending") && (
        <section aria-label="RSVP" className="px-5 py-5">
          <div className="flex items-baseline justify-between gap-3">
            <h3 className={SECTION_TITLE}>RSVP</h3>
            <span className="text-sm">
              {RSVP_STATUS_LABELS[listItem.rsvp_status]}
            </span>
          </div>
          {listItem.rsvp_status !== "pending" && (
            <div className="mt-2">
              <ConfirmResetButton
                label="Reset RSVP"
                title="Reset this hacker's RSVP?"
                description="They will be able to claim or decline their spot again. Their travel form answers and uploaded receipts are cleared with it, since those only exist under a claimed spot. This cannot be undone."
                disabled={grading}
                onConfirm={onResetRSVP}
              />
            </div>
          )}
        </section>
      )}

      {/* Reviewer Notes */}
      <section aria-label="Reviewer notes">
        <ReviewerNotesList flush notes={notes} loading={notesLoading} />
      </section>
    </div>
  );
});
