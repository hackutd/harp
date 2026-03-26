import { useEffect } from "react";
import { useNavigate } from "react-router-dom";

interface UseGradingKeyboardShortcutsOptions {
  disabled: boolean;
  canAct: boolean;
  escapeUrl: string;
  onNavigateNext: () => void;
  onNavigatePrev: () => void;
  onActionJ: () => void;
  onActionK: () => void;
  onActionL: () => void;
}

export function useGradingKeyboardShortcuts({
  disabled,
  canAct,
  escapeUrl,
  onNavigateNext,
  onNavigatePrev,
  onActionJ,
  onActionK,
  onActionL,
}: UseGradingKeyboardShortcutsOptions) {
  const navigate = useNavigate();

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const activeElement = document.activeElement;
      const isInputFocused =
        activeElement instanceof HTMLTextAreaElement ||
        activeElement instanceof HTMLInputElement;

      // Skip all shortcuts when typing in an input
      if (isInputFocused) {
        if (e.key === "Escape") {
          (activeElement as HTMLElement).blur();
        }
        return;
      }

      // Escape: Go back
      if (e.key === "Escape") {
        e.preventDefault();
        navigate(escapeUrl);
        return;
      }

      // Arrow keys: Navigate between items
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

      // Cmd/Ctrl + J/K/L: Action shortcuts
      if ((e.metaKey || e.ctrlKey) && canAct && !disabled) {
        if (e.key === "j") {
          e.preventDefault();
          onActionJ();
        } else if (e.key === "k") {
          e.preventDefault();
          onActionK();
        } else if (e.key === "l") {
          e.preventDefault();
          onActionL();
        }
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [
    disabled,
    canAct,
    escapeUrl,
    onNavigateNext,
    onNavigatePrev,
    onActionJ,
    onActionK,
    onActionL,
    navigate,
  ]);
}
