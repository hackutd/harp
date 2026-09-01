import { ChevronRight } from "lucide-react";
import { useNavigate } from "react-router";

import { CelebrationEffect } from "@/components/CelebrationEffect";
import { Button } from "@/components/ui/button";
import type { Application } from "@/types";

import {
  STATUS_LABELS,
  STATUS_MESSAGES,
  STATUS_PILL_COLORS,
} from "./applicationStatus";

function formatUSD(cents: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 2,
  }).format(cents / 100);
}

interface TravelCard {
  pill: string;
  pillColor: string;
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
    pillColor: "bg-[#7A7973]",
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
        pillColor: "bg-[#8F5F5A]",
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
      pillColor: "bg-[#5A7D63]",
      message:
        "We received your travel details and receipts. The organizing team will follow up about your reimbursement.",
      amountCents: application.travel_approved_amount_cents,
      linkTo: "/app/travel-rsvp",
    };
  }
  if (application.travel_rsvp_status === "declined") {
    return {
      pill: "Reimbursement declined",
      pillColor: "bg-[#7A7973]",
      message:
        "You've declined the travel reimbursement. See you at the event!",
    };
  }
  // Declining the spot is one-shot, so there is no "claim it now" path left —
  // say so instead of pointing at an RSVP the hacker can no longer submit.
  if (application.rsvp_status === "declined") {
    return {
      pill: "Travel approved",
      pillColor: "bg-[#7A7973]",
      message:
        "Your travel reimbursement was approved, but you declined your spot, so there's nothing left to reimburse. If you declined by mistake, reach out to the organizing team.",
    };
  }
  if (application.rsvp_status !== "confirmed") {
    return {
      pill: "Travel approved",
      pillColor: "bg-[#5A7D63]",
      message:
        "Your travel reimbursement was approved! Claim your spot first, then complete the travel form with your travel details and receipts.",
      amountCents: application.travel_approved_amount_cents,
    };
  }
  return {
    pill: "Travel approved",
    pillColor: "bg-[#5A7D63]",
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
    "rounded-xl border border-white/10 bg-[#46453F]/90 bg-[radial-gradient(130%_130%_at_100%_100%,rgba(255,255,255,0.14),rgba(255,255,255,0)_55%)] p-5 text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.10),0_10px_28px_rgba(0,0,0,0.10)] backdrop-blur-xl";

  return (
    <>
      {/* Status card — tappable once submitted, opening the full submission */}
      {canViewSubmission ? (
        <button
          type="button"
          onClick={() => navigate("/app/application")}
          className={`${statusCardShell} group flex w-full items-center justify-between gap-4 text-left transition-opacity hover:opacity-90`}
        >
          <span className="block">
            <span
              className={`inline-block rounded-full px-3 py-1 text-[11px] font-medium tracking-wide text-white ${STATUS_PILL_COLORS[application.status]}`}
            >
              {STATUS_LABELS[application.status]}
            </span>
            <span className="mt-3 block text-xl font-light tracking-tight">
              Application status
            </span>
            <span className="mt-2 block text-sm font-light text-white/70">
              {STATUS_MESSAGES[application.status]}
            </span>
          </span>
          <ChevronRight
            className="size-5 shrink-0 text-white/60 transition-transform group-hover:translate-x-1"
            strokeWidth={1.75}
          />
        </button>
      ) : (
        <div className={statusCardShell}>
          <span
            className={`inline-block rounded-full px-3 py-1 text-[11px] font-medium tracking-wide text-white ${STATUS_PILL_COLORS[application.status]}`}
          >
            {STATUS_LABELS[application.status]}
          </span>
          <h1 className="mt-3 text-xl font-light tracking-tight">
            Application status
          </h1>
          <p className="mt-2 text-sm font-light text-white/70">
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
          <div className="mt-5 rounded-xl border border-[#E5E5E5] p-5">
            <p className="text-sm font-normal text-black">Claim your spot</p>
            <p className="mt-1 text-xs font-light text-[#8A8A8A]">
              Confirm you&apos;re coming so we can save you a seat.
            </p>
            <Button
              onClick={() => navigate("/app/rsvp")}
              className="mt-4 h-12 w-full rounded-full bg-black text-sm font-normal text-white hover:bg-black/85"
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
            className="group mt-5 flex w-full items-center justify-between gap-4 rounded-xl border border-[#E5E5E5] p-5 text-left transition-colors hover:bg-[#FAFAFA]"
          >
            <span className="block">
              <span className="inline-block rounded-full bg-[#5A7D63] px-3 py-1 text-[11px] font-medium tracking-wide text-white">
                Spot claimed
              </span>
              <span className="mt-3 block text-sm font-light text-[#8A8A8A]">
                Your RSVP is confirmed. We can&apos;t wait to see you at the
                event!
              </span>
            </span>
            <ChevronRight
              className="size-5 shrink-0 text-[#8A8A8A] transition-transform group-hover:translate-x-1"
              strokeWidth={1.75}
            />
          </button>
        )}
      {application.status === "accepted" &&
        application.rsvp_status === "declined" && (
          <div className="mt-5 rounded-xl border border-[#E5E5E5] p-5">
            <span className="inline-block rounded-full bg-[#7A7973] px-3 py-1 text-[11px] font-medium tracking-wide text-white">
              Spot declined
            </span>
            <p className="mt-3 text-sm font-light text-[#8A8A8A]">
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
            className="group mt-5 flex w-full items-center justify-between gap-4 rounded-xl border border-[#E5E5E5] p-5 text-left transition-colors hover:bg-[#FAFAFA]"
          >
            <span className="block flex-1">
              <span
                className={`inline-block rounded-full px-3 py-1 text-[11px] font-medium tracking-wide text-white ${travelCard.pillColor}`}
              >
                {travelCard.pill}
              </span>
              <span className="mt-3 block text-sm font-light text-[#8A8A8A]">
                {travelCard.message}
              </span>
              {travelCard.amountCents != null && (
                <span className="mt-4 block rounded-lg bg-[#F5F5F5] p-4">
                  <span className="block text-[11px] font-medium tracking-wide text-[#8A8A8A] uppercase">
                    Approved amount
                  </span>
                  <span className="mt-1 block text-2xl font-light tracking-tight text-black">
                    {formatUSD(travelCard.amountCents)}
                  </span>
                </span>
              )}
            </span>
            <ChevronRight
              className="size-5 shrink-0 text-[#8A8A8A] transition-transform group-hover:translate-x-1"
              strokeWidth={1.75}
            />
          </button>
        ) : (
          <div className="mt-5 rounded-xl border border-[#E5E5E5] p-5">
            <span
              className={`inline-block rounded-full px-3 py-1 text-[11px] font-medium tracking-wide text-white ${travelCard.pillColor}`}
            >
              {travelCard.pill}
            </span>
            <h2 className="mt-3 text-sm font-normal text-black">
              Travel reimbursement
            </h2>
            <p className="mt-1 text-sm font-light text-[#8A8A8A]">
              {travelCard.message}
            </p>
            {travelCard.amountCents != null && (
              <div className="mt-4 rounded-lg bg-[#F5F5F5] p-4">
                <p className="text-[11px] font-medium tracking-wide text-[#8A8A8A] uppercase">
                  Approved amount
                </p>
                <p className="mt-1 text-2xl font-light tracking-tight text-black">
                  {formatUSD(travelCard.amountCents)}
                </p>
              </div>
            )}
            {travelCard.showTravelForm && (
              <Button
                onClick={() => navigate("/app/travel-rsvp")}
                className="mt-4 h-12 w-full rounded-full bg-black text-sm font-normal text-white hover:bg-black/85"
              >
                Complete your travel form
              </Button>
            )}
          </div>
        ))}
    </>
  );
}
