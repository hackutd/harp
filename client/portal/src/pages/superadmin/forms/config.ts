import { CalendarCheck, ClipboardList, Plane } from "lucide-react";

import type { FormKey } from "./types";

export const FORM_CONFIG = {
  application: {
    title: "Application",
    pluralTitle: "Applications",
    audience: "All hackers",
    description: "Application intake, admissions, and travel requests.",
    icon: ClipboardList,
  },
  rsvp: {
    title: "RSVP",
    pluralTitle: "RSVPs",
    audience: "Accepted hackers",
    description: "Spot confirmation and event attendance details.",
    icon: CalendarCheck,
  },
  travel: {
    title: "Travel form",
    pluralTitle: "Travel forms",
    audience: "Approved travelers with a confirmed RSVP",
    description: "Travel details, committed awards, and receipt collection.",
    icon: Plane,
  },
} satisfies Record<FormKey, object>;

export function formatCurrency(cents: number | null | undefined): string {
  if (cents == null) return "—";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 2,
  }).format(cents / 100);
}

export function formatDateTime(value: string | null | undefined): string {
  if (!value) return "No activity yet";
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value));
}

export function isFormOpen(
  form: FormKey,
  availability: { enabled: boolean; due_date?: string },
): boolean {
  if (!availability.enabled) return false;
  if (form !== "application" || !availability.due_date) return true;
  return new Date(availability.due_date).getTime() > Date.now();
}
