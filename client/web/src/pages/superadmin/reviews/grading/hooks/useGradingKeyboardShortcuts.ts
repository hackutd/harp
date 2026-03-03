import { useEffect } from "react";
import { useNavigate } from "react-router-dom";

interface UseGradingKeyboardShortcutsOptions {
  grading: boolean;
  currentApplicationId: string | null;
  onNavigateNext: () => void;
  onNavigatePrev: () => void;
  onGrade: (status: "accepted" | "rejected" | "waitlisted") => void;
}

export function useGradingKeyboardShortcuts({
  grading,
  currentApplicationId,
  onNavigateNext,
  onNavigatePrev,
  onGrade,
}: UseGradingKeyboardShortcutsOptions) {
  const navigate = useNavigate();

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const activeElement = document.activeElement;
      const isInputFocused =
        activeElement instanceof HTMLTextAreaElement ||
        activeElement instanceof HTMLInputElement;

      // Escape: Go back to reviews page
      if (e.key === "Escape") {
        e.preventDefault();
        navigate("/admin/sa/reviews");
        return;
      }

      // Arrow keys: Navigate between applications (only when not typing)
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

      // Cmd/Ctrl + J/K/L: Grade shortcuts
      if ((e.metaKey || e.ctrlKey) && currentApplicationId && !grading) {
        if (e.key === "j") {
          e.preventDefault();
          onGrade("rejected");
        } else if (e.key === "k") {
          e.preventDefault();
          onGrade("waitlisted");
        } else if (e.key === "l") {
          e.preventDefault();
          onGrade("accepted");
        }
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [
    grading,
    currentApplicationId,
    onNavigateNext,
    onNavigatePrev,
    onGrade,
    navigate,
  ]);
}
