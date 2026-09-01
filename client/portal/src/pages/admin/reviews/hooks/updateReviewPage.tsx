import { create } from "zustand";

export interface AssignedState {
  refreshKey: number;
  triggerRefresh: () => void;
}

export const refreshAssignedPage = create<AssignedState>((set) => ({
  refreshKey: 0,
  triggerRefresh: () => set((state) => ({ refreshKey: state.refreshKey + 1 })),
}));
