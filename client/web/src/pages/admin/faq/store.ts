import { create } from "zustand";

import { errorAlert } from "@/shared/lib/api";

import {
  createFAQ as apiCreateFAQ,
  deleteFAQ as apiDeleteFAQ,
  fetchFAQEditPermission,
  fetchFAQs,
  updateFAQ as apiUpdateFAQ,
} from "./api";
import type { FAQ, FAQPayload } from "./types";

function sortByOrder(faqs: FAQ[]): FAQ[] {
  return [...faqs].sort((a, b) => a.display_order - b.display_order);
}

export interface FAQState {
  faqs: FAQ[];
  canEdit: boolean;
  loading: boolean;
  saving: boolean;

  fetch: (signal?: AbortSignal) => Promise<void>;
  createFAQ: (payload: FAQPayload) => Promise<string | null>;
  updateFAQ: (id: string, payload: FAQPayload) => Promise<boolean>;
  deleteFAQ: (id: string) => Promise<boolean>;
}

export const useFAQStore = create<FAQState>((set) => ({
  faqs: [],
  canEdit: false,
  loading: false,
  saving: false,

  fetch: async (signal?: AbortSignal) => {
    set({ loading: true });

    const [listRes, permRes] = await Promise.all([
      fetchFAQs(signal),
      fetchFAQEditPermission(signal),
    ]);

    if (signal?.aborted) return;

    const faqs =
      listRes.status === 200 && listRes.data
        ? sortByOrder(listRes.data.faqs)
        : [];
    const canEdit =
      permRes.status === 200 && permRes.data ? permRes.data.enabled : false;

    set({ faqs, canEdit, loading: false });
  },

  createFAQ: async (payload: FAQPayload) => {
    set({ saving: true });
    const res = await apiCreateFAQ(payload);
    if (res.status === 201 && res.data) {
      const created = res.data;
      set((state) => ({
        faqs: sortByOrder([...state.faqs, created]),
        saving: false,
      }));
      return created.id;
    }
    errorAlert(res);
    set({ saving: false });
    return null;
  },

  updateFAQ: async (id: string, payload: FAQPayload) => {
    set({ saving: true });
    const res = await apiUpdateFAQ(id, payload);
    if (res.status === 200 && res.data) {
      const updated = res.data;
      set((state) => ({
        faqs: sortByOrder(state.faqs.map((f) => (f.id === id ? updated : f))),
        saving: false,
      }));
      return true;
    }
    errorAlert(res);
    set({ saving: false });
    return false;
  },

  deleteFAQ: async (id: string) => {
    set({ saving: true });
    const res = await apiDeleteFAQ(id);
    if (res.status === 204) {
      set((state) => ({
        faqs: state.faqs.filter((f) => f.id !== id),
        saving: false,
      }));
      return true;
    }
    errorAlert(res);
    set({ saving: false });
    return false;
  },
}));
