
import { create } from "zustand";
import Session from "supertokens-auth-react/recipe/session";
import type { User, Application, UserRole } from "./types.d";
import { getRequest } from "./lib/api";

// Auth error info for handling auth method mismatch
interface AuthError {
  status: number;
  message: string;
}

// User Store
interface UserState {
  user: User | null;
  loading: boolean;
  authError: AuthError | null;
  fetchUser: () => Promise<void>;
  setUser: (user: User | null) => void;
  clearUser: () => void;
  clearAuthError: () => void;
  syncRoleFromSession: () => Promise<void>;
}

export const useUserStore = create<UserState>((set, get) => ({
  user: null,
  loading: false,
  authError: null,
  fetchUser: async () => {
    set({ loading: true, authError: null });
    const res = await getRequest<User>("/auth/me", "user");
    if (res.status === 200 && res.data) {
      set({ user: res.data, loading: false });
    } else {
      // Store auth error for handling (especially 409 auth method mismatch)
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
  syncRoleFromSession: async () => {
    const currentUser = get().user;
    if (!currentUser) return;

    if (await Session.doesSessionExist()) {
      const payload = await Session.getAccessTokenPayloadSecurely();
      const sessionRole = payload?.role as UserRole | undefined;
      if (sessionRole && sessionRole !== currentUser.role) {
        set({ user: { ...currentUser, role: sessionRole } });
      }
    }
  },
}));

// Applications Store
interface ApplicationsState {
  applications: Application[];
  loading: boolean;
  fetchApplications: () => Promise<void>;
  setApplications: (applications: Application[]) => void;
}

export const useApplicationsStore = create<ApplicationsState>((set) => ({
  applications: [],
  loading: false,
  fetchApplications: async () => {
    set({ loading: true });
    const res = await getRequest<Application[]>(
      "/v1/admin/applications",
      "applications"
    );
    if (res.status === 200 && res.data) {
      set({ applications: res.data, loading: false });
    } else {
      set({ applications: [], loading: false });
    }
  },
  setApplications: (applications) => set({ applications }),
}));
