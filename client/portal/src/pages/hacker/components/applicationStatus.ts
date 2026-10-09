import type { ApplicationStatus } from "@/types";

import { pillClass } from "./tones";

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

// Pre-decision states stay inside the palette; only outcomes take a status
// colour.
export const STATUS_PILL_CLASSES: Record<ApplicationStatus, string> = {
  draft: pillClass("neutral"),
  submitted: pillClass("info"),
  accepted: pillClass("success"),
  rejected: pillClass("danger"),
  waitlisted: pillClass("warning"),
};
