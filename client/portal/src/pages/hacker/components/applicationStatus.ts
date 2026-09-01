import type { ApplicationStatus } from "@/types";

export const STATUS_LABELS: Record<ApplicationStatus, string> = {
  draft: "In progress",
  submitted: "Under review",
  accepted: "Accepted",
  rejected: "Not accepted",
  waitlisted: "Waitlisted",
};

export const STATUS_MESSAGES: Record<ApplicationStatus, string> = {
  draft: "Your application is saved as a draft. Submit it when you're ready.",
  submitted:
    "Your application has been submitted and is under review. We'll notify you once a decision is made.",
  accepted: "Congratulations! Your application has been accepted.",
  rejected:
    "Thank you for applying. Unfortunately, we cannot accept your application at this time.",
  waitlisted:
    "Your application is on the waitlist. We'll notify you if a spot becomes available.",
};

// Muted, desaturated tints so the pill reads as an outcome without shouting
// over the card behind it. Pre-decision states stay neutral gray.
export const STATUS_PILL_COLORS: Record<ApplicationStatus, string> = {
  draft: "bg-[#7A7973]",
  submitted: "bg-[#7A7973]",
  accepted: "bg-[#5A7D63]",
  rejected: "bg-[#8F5F5A]",
  waitlisted: "bg-[#8A7444]",
};
