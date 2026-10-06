import { type RefObject, useEffect } from "react";

/** Popups that own Tab themselves (dialogs, selects, menus). */
const POPUP_SELECTOR =
  '[role="dialog"], [role="alertdialog"], [role="listbox"], [role="menu"]';

/**
 * Tab jumps to the review notes from anywhere outside the grading panel.
 * Inside the panel, and in any open popup, Tab keeps its normal behaviour so
 * keyboard users can still reach the vote buttons.
 */
export function useTabToFocusNotes(
  panelRef: RefObject<HTMLElement | null>,
  notesRef: RefObject<HTMLTextAreaElement | null>,
  enabled: boolean,
) {
  useEffect(() => {
    if (!enabled) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (
        e.key !== "Tab" ||
        e.shiftKey ||
        e.metaKey ||
        e.ctrlKey ||
        e.altKey ||
        e.defaultPrevented
      ) {
        return;
      }

      const notes = notesRef.current;
      if (!notes || notes.disabled) return;

      const active = document.activeElement;
      if (active instanceof Element) {
        if (panelRef.current?.contains(active)) return;
        if (active.closest(POPUP_SELECTOR)) return;
        if (
          active instanceof HTMLInputElement ||
          active instanceof HTMLTextAreaElement ||
          active instanceof HTMLSelectElement ||
          (active instanceof HTMLElement && active.isContentEditable)
        ) {
          return;
        }
      }

      e.preventDefault();
      notes.focus();
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [enabled, panelRef, notesRef]);
}
