import { create } from "zustand";

import { getRequest } from "@/shared/lib/api";
import type { Application } from "@/types";

// Whether the signed-in hacker is a confirmed attendee (accepted with a
// confirmed RSVP) — the same rule the server uses to open the attendee
// directory. Attendee-only navigation stays hidden until this is true.
export interface AttendeeState {
  /** The user the answer belongs to, so a sign-in swap never reuses it. */
  userId: string | null;
  confirmed: boolean;
  /** First and last name from the application, if the hacker has set them. */
  name: string | null;
  fetchAttendee: (userId: string, signal?: AbortSignal) => Promise<void>;
  setConfirmed: (userId: string, confirmed: boolean) => void;
}

// Names are ordinary schema answers, so they live in `responses`.
function applicationName(app: Application | undefined): string | null {
  const parts = [app?.responses["first_name"], app?.responses["last_name"]]
    .filter((v): v is string => typeof v === "string")
    .map((v) => v.trim())
    .filter(Boolean);
  return parts.length > 0 ? parts.join(" ") : null;
}

export const useAttendeeStore = create<AttendeeState>((set) => ({
  userId: null,
  confirmed: false,
  name: null,
  fetchAttendee: async (userId, signal) => {
    const res = await getRequest<Application>(
      "/applications/me",
      "application",
      signal,
    );
    if (signal?.aborted) return;
    // No application (404) or a failed request both leave the features
    // hidden; the next mount tries again.
    const app = res.status === 200 ? res.data : undefined;
    set({
      userId,
      confirmed: app?.status === "accepted" && app.rsvp_status === "confirmed",
      name: applicationName(app),
    });
  },
  setConfirmed: (userId, confirmed) => set({ userId, confirmed }),
}));
