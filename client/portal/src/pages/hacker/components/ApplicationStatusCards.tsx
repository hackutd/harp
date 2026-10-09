import { IconChevronRight } from "@tabler/icons-react";
import { useNavigate } from "react-router";

import { CelebrationEffect } from "@/components/CelebrationEffect";
import { Button } from "@/components/ui/button";
import type { Application } from "@/types";

import {
  STATUS_LABELS,
  STATUS_MESSAGES,
  STATUS_PILL_CLASSES,
} from "./applicationStatus";
import { pillClass, type Tone } from "./tones";

function formatUSD(cents: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 2,
  }).format(cents / 100);
}

interface TravelCard {
  pill: string;
  tone: Tone;
  message: string;
  /** Approved reimbursement amount, surfaced to motivate completing the RSVP/travel form. */
  amountCents?: number | null;
  /** Show the "Complete your travel form" CTA linking to /app/travel-rsvp. */
  showTravelForm?: boolean;
  /** When set, the whole card is a link to review the submitted travel details. */
  linkTo?: string;
}

// Travel reimbursement card copy, shown only when the hacker opted in. Travel
// is decided independently of the application, so the outcome is only shown
// once the application itself is decided — an approval a waitlisted applicant
// can't act on (or a travel rejection they'd read as their decision) is worse
// than saying nothing. Once travel is approved, the card follows the travel
// RSVP (proof of travel) state.
function travelCardContent(application: Application): TravelCard | null {
  if (application.travel_status === "not_requested") {
    return null;
  }

  const underReview: TravelCard = {
    pill: "Travel under review",
    tone: "neutral",
    message:
      "We're reviewing your travel reimbursement request. You'll see the decision here once it's made.",
  };

  if (application.status === "rejected") {
    return null;
  }
  if (application.status !== "accepted") {
    return underReview;
  }

  switch (application.travel_status) {
    case "pending":
      return underReview;
    case "rejected":
      return {
        pill: "Travel not approved",
        tone: "danger",
        message:
          "We couldn't approve your travel reimbursement request this time. This doesn't affect your application decision.",
      };
    default:
      break;
  }

  // Approved: the next step is the travel RSVP form.
  if (application.travel_rsvp_status === "confirmed") {
    return {
      pill: "Travel details submitted",
      tone: "success",
      message:
        "We received your travel details and receipts. The organizing team will follow up about your reimbursement.",
      amountCents: application.travel_approved_amount_cents,
      linkTo: "/app/travel-rsvp",
    };
  }
  if (application.travel_rsvp_status === "declined") {
    return {
      pill: "Reimbursement declined",
      tone: "neutral",
      message:
        "You've declined the travel reimbursement. See you at the event!",
    };
  }
  // Declining the spot is one-shot, so there is no "claim it now" path left —
  // say so instead of pointing at an RSVP the hacker can no longer submit.
  if (application.rsvp_status === "declined") {
    return {
      pill: "Travel approved",
      tone: "neutral",
      message:
        "Your travel reimbursement was approved, but you declined your spot, so there's nothing left to reimburse. If you declined by mistake, reach out to the organizing team.",
    };
  }
  if (application.rsvp_status !== "confirmed") {
    return {
      pill: "Travel approved",
      tone: "success",
      message:
        "Your travel reimbursement was approved! Claim your spot first, then complete the travel form with your travel details and receipts.",
      amountCents: application.travel_approved_amount_cents,
    };
  }
  return {
    pill: "Travel approved",
    tone: "success",
    message:
      "Your travel reimbursement was approved! Complete the travel form with your travel details, ticket receipts, and payment info.",
    amountCents: application.travel_approved_amount_cents,
    showTravelForm: true,
  };
}

interface ApplicationStatusCardsProps {
  application: Application;
}

/**
 * The application decision card cluster shared by the dashboard and the status
 * page: the status card (tappable once submitted, opening the full
 * submission), the one-time accepted celebration, the RSVP state, and the
 * travel reimbursement card.
 */
export function ApplicationStatusCards({
  application,
}: ApplicationStatusCardsProps) {
  const navigate = useNavigate();

  const travelCard = travelCardContent(application);
  const travelLink = travelCard?.linkTo;
  // Drafts have nothing submitted to review yet — the card stays static.
  const canViewSubmission = application.status !== "draft";

  const statusCardShell =
    "hacker-application-card rounded-xl bg-surface p-5 text-ink";

  return (
    <>
      {/* Status card — tappable once submitted, opening the full submission */}
      {canViewSubmission ? (
        <button
          type="button"
          onClick={() => navigate("/app/application")}
          className={`${statusCardShell} group flex w-full items-center justify-between gap-4 text-left transition-colors hover:bg-surface-2`}
        >
          <span className="block">
            <span className={STATUS_PILL_CLASSES[application.status]}>
              {STATUS_LABELS[application.status]}
            </span>
            <span className="mt-3 block text-xl font-light tracking-tight">
              Application status
            </span>
            <span className="mt-2 block text-sm font-light text-ink/75">
              {STATUS_MESSAGES[application.status]}
            </span>
          </span>
          <IconChevronRight
            className="size-5 shrink-0 text-ink transition-transform group-hover:translate-x-1"
            strokeWidth={1.75}
          />
        </button>
      ) : (
        <div className={statusCardShell}>
          <span className={STATUS_PILL_CLASSES[application.status]}>
            {STATUS_LABELS[application.status]}
          </span>
          <h2 className="mt-3 text-xl font-light tracking-tight">
            Application status
          </h2>
          <p className="mt-2 text-sm font-light text-ink/75">
            {STATUS_MESSAGES[application.status]}
          </p>
        </div>
      )}

      {/* Accepted celebration: fires once when an accepted hacker sees their decision */}
      {application.status === "accepted" && (
        <CelebrationEffect id={application.id} type="accepted" />
      )}

      {/* RSVP: accepted hackers claim (or decline) their spot */}
      {application.status === "accepted" &&
        application.rsvp_status === "pending" && (
          <div className={`mt-4 ${statusCardShell}`}>
            <p className="text-sm font-normal text-ink">Claim your spot</p>
            <p className="mt-1 text-xs font-light text-ink/55">
              Confirm you&apos;re coming so we can save you a seat.
            </p>
            <Button
              onClick={() => navigate("/app/rsvp")}
              className="mt-4 h-12 w-full rounded-full bg-tide text-sm font-normal text-white hover:bg-tide-hover"
            >
              RSVP to claim your spot
            </Button>
          </div>
        )}
      {application.status === "accepted" &&
        application.rsvp_status === "confirmed" && (
          <button
            type="button"
            onClick={() => navigate("/app/rsvp")}
            className={`${statusCardShell} group mt-4 flex w-full items-center justify-between gap-4 text-left transition-colors hover:bg-surface-2`}
          >
            <span className="block">
              <span className={pillClass("success")}>Spot claimed</span>
              <span className="mt-3 block text-sm font-light text-ink/65">
                Your RSVP is confirmed. We can&apos;t wait to see you at the
                event!
              </span>
            </span>
            <IconChevronRight
              className="size-5 shrink-0 text-ink transition-transform group-hover:translate-x-1"
              strokeWidth={1.75}
            />
          </button>
        )}
      {application.status === "accepted" &&
        application.rsvp_status === "declined" && (
          <div className={`mt-4 ${statusCardShell}`}>
            <span className={pillClass("neutral")}>Spot declined</span>
            <p className="mt-3 text-sm font-light text-ink/65">
              You&apos;ve declined your spot. Sorry you can&apos;t make it — we
              hope to see you next time!
            </p>
          </div>
        )}

      {/* Travel reimbursement: reviewed separately from the application */}
      {travelCard &&
        (travelLink ? (
          <button
            type="button"
            onClick={() => navigate(travelLink)}
            className={`${statusCardShell} group mt-4 flex w-full items-center justify-between gap-4 text-left transition-colors hover:bg-surface-2`}
          >
            <span className="block flex-1">
              <span className={pillClass(travelCard.tone)}>
                {travelCard.pill}
              </span>
              <span className="mt-3 block text-sm font-light text-ink/65">
                {travelCard.message}
              </span>
              {travelCard.amountCents != null && (
                <span className="mt-4 block rounded-lg bg-ink/[0.03] p-4">
                  <span className="block text-[11px] font-medium tracking-wide text-ink/55 uppercase">
                    Approved amount
                  </span>
                  <span className="mt-1 block text-2xl font-light tracking-tight text-ink">
                    {formatUSD(travelCard.amountCents)}
                  </span>
                </span>
              )}
            </span>
            <IconChevronRight
              className="size-5 shrink-0 text-ink transition-transform group-hover:translate-x-1"
              strokeWidth={1.75}
            />
          </button>
        ) : (
          <div className={`mt-4 ${statusCardShell}`}>
            <span className={pillClass(travelCard.tone)}>
              {travelCard.pill}
            </span>
            <h2 className="mt-3 text-sm font-normal text-ink">
              Travel reimbursement
            </h2>
            <p className="mt-1 text-sm font-light text-ink/65">
              {travelCard.message}
            </p>
            {travelCard.amountCents != null && (
              <div className="mt-4 rounded-lg bg-ink/[0.03] p-4">
                <p className="text-[11px] font-medium tracking-wide text-ink/55 uppercase">
                  Approved amount
                </p>
                <p className="mt-1 text-2xl font-light tracking-tight text-ink">
                  {formatUSD(travelCard.amountCents)}
                </p>
              </div>
            )}
            {travelCard.showTravelForm && (
              <Button
                onClick={() => navigate("/app/travel-rsvp")}
                className="mt-4 h-12 w-full rounded-full bg-tide text-sm font-normal text-white hover:bg-tide-hover"
              >
                Complete your travel form
              </Button>
            )}
          </div>
        ))}
    </>
  );
}
