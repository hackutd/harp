import { useEffect } from "react";

import type { Review, ReviewVote } from "../types";

interface UseReviewKeyboardShortcutsOptions {
  isExpanded: boolean;
  selectedId: string | null;
  reviews: Review[];
  submitting: boolean;
  notesTextareaRef: React.RefObject<HTMLTextAreaElement | null>;
  onVote: (id: string, vote: ReviewVote) => void;
  onNavigate: (id: string) => void;
  onCloseExpanded: () => void;
}

export function useReviewKeyboardShortcuts({
  isExpanded,
  selectedId,
  reviews,
  submitting,
  notesTextareaRef,
  onVote,
  onNavigate,
  onCloseExpanded,
}: UseReviewKeyboardShortcutsOptions) {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const activeElement = document.activeElement;
      const isInputFocused =
        activeElement instanceof HTMLTextAreaElement ||
        activeElement instanceof HTMLInputElement;

      // Escape: Close expanded view
      if (e.key === "Escape" && isExpanded) {
        e.preventDefault();
        onCloseExpanded();
        return;
      }

      // Tab: Focus notes textarea in expanded view
      if (e.key === "Tab" && isExpanded && selectedId && !isInputFocused) {
        e.preventDefault();
        notesTextareaRef.current?.focus();
        return;
      }

      // Arrow keys: Navigate between reviews (only when not typing)
      if (!isInputFocused && reviews.length > 0) {
        const currentIndex = selectedId
          ? reviews.findIndex((r) => r.id === selectedId)
          : -1;

        if (e.key === "ArrowUp" || e.key === "ArrowLeft") {
          e.preventDefault();
          if (currentIndex > 0) {
            onNavigate(reviews[currentIndex - 1].id);
          } else if (currentIndex === -1) {
            onNavigate(reviews[reviews.length - 1].id);
          }
        } else if (e.key === "ArrowDown" || e.key === "ArrowRight") {
          e.preventDefault();
          if (currentIndex === -1) {
            onNavigate(reviews[0].id);
          } else if (currentIndex < reviews.length - 1) {
            onNavigate(reviews[currentIndex + 1].id);
          }
        }
      }

      // Cmd/Ctrl + J/K/L: Vote shortcuts (only in expanded view with selected review)
      if ((e.metaKey || e.ctrlKey) && isExpanded && selectedId) {
        const selectedReview = reviews.find((r) => r.id === selectedId);
        // Don't allow voting if already voted or submitting
        if (selectedReview?.vote || submitting) return;

        if (e.key === "j") {
          e.preventDefault();
          onVote(selectedId, "reject");
        } else if (e.key === "k") {
          e.preventDefault();
          onVote(selectedId, "waitlist");
        } else if (e.key === "l") {
          e.preventDefault();
          onVote(selectedId, "accept");
        }
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [
    isExpanded,
    selectedId,
    reviews,
    submitting,
    notesTextareaRef,
    onVote,
    onNavigate,
    onCloseExpanded,
  ]);
}
