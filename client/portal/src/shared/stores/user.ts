import { create } from "zustand";

import { errorAlert, getRequest, patchRequest } from "@/shared/lib/api";
import { writeCachedTheme } from "@/shared/lib/theme";
import type { Theme, User } from "@/types";

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
  updateTheme: (theme: Theme) => Promise<void>;
}

export const useUserStore = create<UserState>((set, get) => ({
  user: null,
  loading: false,
  authError: null,
  fetchUser: async () => {
    set({ loading: true, authError: null });
    const res = await getRequest<User>("/auth/me", "user");
    if (res.status === 200 && res.data) {
      writeCachedTheme(res.data.theme);
      set({ user: res.data, loading: false });
    } else {
      // 409 auth method mismatch
      set({
        user: null,
        loading: false,
        authError: res.error
          ? { status: res.status, message: res.error }
          : null,
      });
    }
  },
  setUser: (user) => set({ user }),
  clearUser: () => set({ user: null, authError: null }),
  clearAuthError: () => set({ authError: null }),
  // Optimistic: the portal repaints on tap, and rolls back if the save fails.
  updateTheme: async (theme) => {
    const user = get().user;
    if (!user || user.theme === theme) return;

    const previous = user.theme;
    writeCachedTheme(theme);
    set({ user: { ...user, theme } });

    const res = await patchRequest<User>("/users/me/theme", { theme }, "theme");
    const current = get().user;
    // Signed out, or another change landed meanwhile: leave that state alone.
    if (!current || current.id !== user.id || current.theme !== theme) return;

    if (res.status === 200 && res.data) {
      set({ user: res.data });
    } else {
      writeCachedTheme(previous);
      set({ user: { ...current, theme: previous } });
      errorAlert(res);
    }
  },
}));
