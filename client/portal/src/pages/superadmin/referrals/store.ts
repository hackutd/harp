import { create } from "zustand";

import { errorAlert } from "@/shared/lib/api";

import {
  createReferral as apiCreateReferral,
  deleteReferral as apiDeleteReferral,
  fetchReferrals,
  updateReferral as apiUpdateReferral,
} from "./api";
import type {
  CreateReferralPayload,
  Referral,
  UpdateReferralPayload,
} from "./types";

export interface ReferralsState {
  referrals: Referral[];
  loading: boolean;
  saving: boolean;

  fetch: (signal?: AbortSignal) => Promise<void>;
  createReferral: (payload: CreateReferralPayload) => Promise<Referral | null>;
  updateReferral: (
    id: string,
    payload: UpdateReferralPayload,
  ) => Promise<boolean>;
  deleteReferral: (id: string) => Promise<boolean>;
}

export const useReferralsStore = create<ReferralsState>((set) => ({
  referrals: [],
  loading: false,
  saving: false,

  fetch: async (signal) => {
    set({ loading: true });
    const res = await fetchReferrals(signal);
    if (signal?.aborted) return;

    if (res.status === 200 && res.data) {
      set({ referrals: res.data.referrals, loading: false });
    } else {
      errorAlert(res);
      set({ loading: false });
    }
  },

  createReferral: async (payload) => {
    set({ saving: true });
    const res = await apiCreateReferral(payload);
    if (res.status === 201 && res.data) {
      const created = res.data;
      // The list is newest first.
      set((state) => ({
        referrals: [created, ...state.referrals],
        saving: false,
      }));
      return created;
    }
    errorAlert(res);
    set({ saving: false });
    return null;
  },

  updateReferral: async (id, payload) => {
    set({ saving: true });
    const res = await apiUpdateReferral(id, payload);
    if (res.status === 200 && res.data) {
      const updated = res.data;
      set((state) => ({
        referrals: state.referrals.map((r) => (r.id === id ? updated : r)),
        saving: false,
      }));
      return true;
    }
    errorAlert(res);
    set({ saving: false });
    return false;
  },

  deleteReferral: async (id) => {
    set({ saving: true });
    const res = await apiDeleteReferral(id);
    if (res.status === 204) {
      set((state) => ({
        referrals: state.referrals.filter((r) => r.id !== id),
        saving: false,
      }));
      return true;
    }
    errorAlert(res);
    set({ saving: false });
    return false;
  },
}));
