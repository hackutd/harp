import { create } from "zustand";

// The account Settings dialog. Both portal layouts render it once; the
// sidebar's account menu and the Profile page's gear button open it.
export interface SettingsDialogState {
  open: boolean;
  setOpen: (open: boolean) => void;
}

export const useSettingsDialogStore = create<SettingsDialogState>((set) => ({
  open: false,
  setOpen: (open) => set({ open }),
}));
