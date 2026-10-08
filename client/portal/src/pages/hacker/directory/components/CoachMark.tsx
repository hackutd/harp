import { IconHandStop, IconX } from "@tabler/icons-react";
import { useState } from "react";

import { COACH_MARK_KEY } from "../utils";

function seen(): boolean {
  try {
    return localStorage.getItem(COACH_MARK_KEY) === "1";
  } catch {
    return true;
  }
}

// One-time hint for touch users: a right swipe isn't a silent bookmark, it
// pokes the other person.
export function SwipeCoachMark() {
  const [open, setOpen] = useState(() => !seen());
  if (!open) return null;

  const dismiss = () => {
    try {
      localStorage.setItem(COACH_MARK_KEY, "1");
    } catch {
      // Storage unavailable (private mode); it just shows again next visit.
    }
    setOpen(false);
  };

  return (
    <div
      role="note"
      className="mb-4 flex items-start gap-3 rounded-xl border border-ice/30 bg-ice/10 p-4 md:hidden"
    >
      <IconHandStop className="mt-0.5 size-5 shrink-0 text-ink" />
      <div className="flex-1 text-sm font-light text-ink/85">
        <p className="font-medium text-ink">Swipe right sends a poke</p>
        <p className="mt-0.5">
          They'll get a notification and the card is saved to your contacts.
          Swipe left to hide someone. You can undo hides from the Hidden filter.
        </p>
      </div>
      <button
        type="button"
        onClick={dismiss}
        aria-label="Got it"
        className="rounded-full p-1 text-ink/65 hover:bg-ink/5"
      >
        <IconX className="size-4" />
      </button>
    </div>
  );
}
