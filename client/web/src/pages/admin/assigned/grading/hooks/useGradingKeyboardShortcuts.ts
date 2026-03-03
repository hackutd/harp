import { useEffect } from "react";
import { useNavigate } from "react-router-dom";

import type { ReviewVote } from "../../types";

interface UseGradingKeyboardShortcutsOptions {
  submitting: boolean;
  currentReviewId: string | null;
  hasVoted: boolean;
  onNavigateNext: () => void;
  onNavigatePrev: () => void;
  onVote: (vote: ReviewVote) => void;
}

export function useGradingKeyboardShortcuts({
  submitting,
  currentReviewId,
  hasVoted,
  onNavigateNext,
  onNavigatePrev,
  onVote,
}: UseGradingKeyboardShortcutsOptions) {
  const navigate = useNavigate();

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const activeElement = document.activeElement;
      const isInputFocused =
        activeElement instanceof HTMLTextAreaElement ||
        activeElement instanceof HTMLInputElement;

      // Escape: Go back to assigned page
      if (e.key === "Escape") {
        e.preventDefault();
        navigate("/admin/assigned");
        return;
      }

      // Arrow keys: Navigate between reviews (only when not typing)
      if (!isInputFocused) {
        if (e.key === "ArrowLeft" || e.key === "ArrowUp") {
          e.preventDefault();
          onNavigatePrev();
          return;
        }
        if (e.key === "ArrowRight" || e.key === "ArrowDown") {
          e.preventDefault();
          onNavigateNext();
          return;
        }
      }

      // Cmd/Ctrl + J/K/L: Vote shortcuts
      if (
        (e.metaKey || e.ctrlKey) &&
        currentReviewId &&
        !submitting &&
        !hasVoted
      ) {
        if (e.key === "j") {
          e.preventDefault();
          onVote("reject");
        } else if (e.key === "k") {
          e.preventDefault();
          onVote("waitlist");
        } else if (e.key === "l") {
          e.preventDefault();
          onVote("accept");
        }
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [
    submitting,
    currentReviewId,
    hasVoted,
    onNavigateNext,
    onNavigatePrev,
    onVote,
    navigate,
  ]);
}
