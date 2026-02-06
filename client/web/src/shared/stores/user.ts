import { create } from "zustand";

import { getRequest } from "@/shared/lib/api";
import type { User } from "@/types";

// Auth error info for handling auth method mismatch
export interface AuthError {
  status: number;
  message: string;
}

// User Store State
export interface UserState {
  user: User | null;
  loading: boolean;
  authError: AuthError | null;
  fetchUser: () => Promise<void>;
  setUser: (user: User | null) => void;
  clearUser: () => void;
  clearAuthError: () => void;
}

export const useUserStore = create<UserState>((set) => ({
  user: null,
  loading: false,
  authError: null,
  fetchUser: async () => {
    set({ loading: true, authError: null });
    const res = await getRequest<User>("/auth/me", "user");
    if (res.status === 200 && res.data) {
      set({ user: res.data, loading: false });
    } else {
      // 409 auth method mismatch
      set({
        user: null,
        loading: false,
        authError: res.error ? { status: res.status, message: res.error } : null,
      });
    }
  },
  setUser: (user) => set({ user }),
  clearUser: () => set({ user: null, authError: null }),
  clearAuthError: () => set({ authError: null }),
}));
