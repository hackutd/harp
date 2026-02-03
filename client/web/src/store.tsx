
import { create } from "zustand";
import type { User, ApplicationListItem, ApplicationListResult, ApplicationStatus, ApplicationStats, Review, PendingReviewsResponse } from "./types.d";
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
  stats: ApplicationStats | null;
  statsLoading: boolean;
  fetchApplications: (params?: FetchParams) => Promise<void>;
  fetchStats: () => Promise<void>;
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
  stats: null,
  statsLoading: false,

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

  fetchStats: async () => {
    set({ statsLoading: true });

    const res = await getRequest<ApplicationStats>("/v1/admin/applications/stats", "stats");

    if (res.status === 200 && res.data) {
      set({ stats: res.data, statsLoading: false });
    } else {
      set({ stats: null, statsLoading: false });
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

// Reviews Store
interface SubmitVotePayload {
  vote: 'accept' | 'reject' | 'waitlist';
  notes?: string;
}

interface ReviewsState {
  reviews: Review[];
  loading: boolean;
  submitting: boolean;
  fetchPendingReviews: () => Promise<void>;
  submitVote: (reviewId: string, payload: SubmitVotePayload) => Promise<{ success: boolean; error?: string }>;
}

export const useReviewsStore = create<ReviewsState>((set) => ({
  reviews: [],
  loading: false,
  submitting: false,

  fetchPendingReviews: async () => {
    set({ loading: true });

    const res = await getRequest<PendingReviewsResponse>("/v1/admin/reviews/pending", "pending reviews");

    if (res.status === 200 && res.data) {
      set({ reviews: res.data.reviews, loading: false });
    } else {
      set({ reviews: [], loading: false });
    }
  },

  submitVote: async (reviewId: string, payload: SubmitVotePayload) => {
    set({ submitting: true });

    const res = await fetch(`/v1/admin/reviews/${reviewId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(payload),
    });

    if (res.ok) {
      const data = await res.json().catch(() => ({}));
      // Update the review in place with the returned data
      set((state) => ({
        reviews: state.reviews.map((r) =>
          r.id === reviewId
            ? { ...r, vote: payload.vote, notes: payload.notes ?? r.notes, reviewed_at: data.review?.reviewed_at ?? new Date().toISOString() }
            : r
        ),
        submitting: false,
      }));
      return { success: true };
    } else {
      set({ submitting: false });
      const data = await res.json().catch(() => ({}));
      return { success: false, error: data.error || 'Failed to submit vote' };
    }
  },
}));
