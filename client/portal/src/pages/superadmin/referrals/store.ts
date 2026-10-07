import { create } from "zustand";

import { errorAlert } from "@/shared/lib/api";

import {
  createReferral as apiCreateReferral,
  deleteReferral as apiDeleteReferral,
  fetchReferrals,
  fetchReferralSignups,
  updateReferral as apiUpdateReferral,
} from "./api";
import type {
  CreateReferralPayload,
  Referral,
  ReferralSignup,
  UpdateReferralPayload,
} from "./types";

export interface ReferralsState {
  referrals: Referral[];
  loading: boolean;
  saving: boolean;
  // Signups of one referral at a time, for the signups dialog. Null while
  // loading, so switching rows never shows the previous referral's emails.
  signupsReferralID: string | null;
  signups: ReferralSignup[] | null;

  fetch: (signal?: AbortSignal) => Promise<void>;
  fetchSignups: (id: string, signal?: AbortSignal) => Promise<void>;
  createReferral: (payload: CreateReferralPayload) => Promise<Referral | null>;
  updateReferral: (
    id: string,
    payload: UpdateReferralPayload,
  ) => Promise<boolean>;
  deleteReferral: (id: string) => Promise<boolean>;
}

export const useReferralsStore = create<ReferralsState>((set, get) => ({
  referrals: [],
  loading: false,
  saving: false,
  signupsReferralID: null,
  signups: null,

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

  fetchSignups: async (id, signal) => {
    set({ signupsReferralID: id, signups: null });
    const res = await fetchReferralSignups(id, signal);
    // Drop a response for a referral the dialog has moved away from.
    if (signal?.aborted || get().signupsReferralID !== id) return;

    if (res.status === 200 && res.data) {
      set({ signups: res.data.signups });
    } else {
      errorAlert(res);
      set({ signups: [] });
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
