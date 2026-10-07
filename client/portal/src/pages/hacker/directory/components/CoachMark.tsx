import { Hand, X } from "lucide-react";
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
      className="mb-4 flex items-start gap-3 rounded-xl border border-[#21FFF0]/30 bg-[#21FFF0]/[0.07] p-4 md:hidden"
    >
      <Hand className="mt-0.5 size-5 shrink-0 text-[#21FFF0]" />
      <div className="flex-1 text-sm font-light text-white/85">
        <p className="font-medium text-white">Swipe right sends a poke</p>
        <p className="mt-0.5">
          They'll get a notification and the card is saved to your contacts.
          Swipe left to hide someone. You can undo hides from the Hidden filter.
        </p>
      </div>
      <button
        type="button"
        onClick={dismiss}
        aria-label="Got it"
        className="rounded-full p-1 text-white/60 hover:bg-white/10"
      >
        <X className="size-4" />
      </button>
    </div>
  );
}
