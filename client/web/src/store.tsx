
import { create } from "zustand";
import type { User, ApplicationListItem, ApplicationListResult, ApplicationStatus } from "./types.d";
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

// Applications Store cursor pagination
interface FetchParams {
  cursor?: string;
  status?: ApplicationStatus | null; // null = clear filter, undefined = keep current
  direction?: 'forward' | 'backward';
}

interface ApplicationsState {
  applications: ApplicationListItem[];
  loading: boolean;
  nextCursor: string | null;
  prevCursor: string | null;
  hasMore: boolean;
  currentStatus: ApplicationStatus | null;
  fetchApplications: (params?: FetchParams) => Promise<void>;
  setStatusFilter: (status: ApplicationStatus | null) => void;
  resetPagination: () => void;
}

export const useApplicationsStore = create<ApplicationsState>((set, get) => ({
  applications: [],
  loading: false,
  nextCursor: null,
  prevCursor: null,
  hasMore: false,
  currentStatus: null,

  fetchApplications: async (params?: FetchParams) => {
    set({ loading: true });

    const queryParams = new URLSearchParams();

    // grab status
    let status: ApplicationStatus | null;
    if (params && 'status' in params) {
      // could be null to clear or a value
      status = params.status ?? null;
    } else {
      // No status in params -> keep current filter
      status = get().currentStatus;
    }

    if (status) {
      queryParams.set('status', status);
    }

    if (params?.cursor) {
      queryParams.set('cursor', params.cursor);
    }

    if (params?.direction) {
      queryParams.set('direction', params.direction);
    }

    const queryString = queryParams.toString();
    const endpoint = `/v1/admin/applications${queryString ? `?${queryString}` : ''}`;

    const res = await getRequest<ApplicationListResult>(endpoint, "applications");

    if (res.status === 200 && res.data) {
      set({
        applications: res.data.applications,
        nextCursor: res.data.next_cursor,
        prevCursor: res.data.prev_cursor,
        hasMore: res.data.has_more,
        loading: false,
        currentStatus: status,
      });
    } else {
      set({
        applications: [],
        nextCursor: null,
        prevCursor: null,
        hasMore: false,
        loading: false,
      });
    }
  },

  setStatusFilter: (status) => {
    set({ currentStatus: status });
  },

  resetPagination: () => {
    set({
      applications: [],
      nextCursor: null,
      prevCursor: null,
      hasMore: false,
      currentStatus: null,
    });
  },
}));
