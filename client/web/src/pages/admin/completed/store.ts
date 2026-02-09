import { create } from 'zustand';

import { fetchCompletedReviews } from './api';
import type { Review } from './types';

export interface CompletedReviewsState {
  reviews: Review[];
  loading: boolean;
  fetchCompletedReviews: () => Promise<void>;
}

export const useCompletedReviewsStore = create<CompletedReviewsState>((set) => ({
  reviews: [],
  loading: false,

  fetchCompletedReviews: async () => {
    set({ loading: true });

    const res = await fetchCompletedReviews();

    if (res.status === 200 && res.data) {
      set({ reviews: res.data.reviews, loading: false });
    } else {
      set({ reviews: [], loading: false });
    }
  },
}));
