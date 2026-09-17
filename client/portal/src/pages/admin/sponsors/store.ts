import { create } from "zustand";

import {
  createSponsor as apiCreateSponsor,
  deleteSponsor as apiDeleteSponsor,
  fetchSponsors,
  updateSponsor as apiUpdateSponsor,
  uploadSponsorLogo,
} from "./api";
import type { Sponsor, SponsorPayload } from "./types";

export interface SponsorsState {
  sponsors: Sponsor[];
  loading: boolean;
  saving: boolean;

  fetch: (signal?: AbortSignal) => Promise<void>;
  createSponsor: (payload: SponsorPayload) => Promise<string | null>;
  updateSponsor: (id: string, payload: SponsorPayload) => Promise<boolean>;
  deleteSponsor: (id: string) => Promise<boolean>;
  uploadLogo: (
    sponsorId: string,
    file: File,
  ) => Promise<{ success: boolean } | null>;
}

export const useSponsorsStore = create<SponsorsState>((set) => ({
  sponsors: [],
  loading: false,
  saving: false,

  fetch: async (signal?: AbortSignal) => {
    set({ loading: true });

    const res = await fetchSponsors(signal);

    if (signal?.aborted) return;

    if (res.status === 200 && res.data) {
      set({ sponsors: res.data.sponsors, loading: false });
    } else {
      set({ sponsors: [], loading: false });
    }
  },

  createSponsor: async (payload: SponsorPayload) => {
    set({ saving: true });
    const res = await apiCreateSponsor(payload);
    if (res.status === 201 && res.data) {
      const created = res.data as Sponsor;
      set((state) => ({
        sponsors: [...state.sponsors, created],
        saving: false,
      }));
      return created.id;
    }
    set({ saving: false });
    return null;
  },

  updateSponsor: async (id: string, payload: SponsorPayload) => {
    set({ saving: true });
    const res = await apiUpdateSponsor(id, payload);
    if (res.status === 200 && res.data) {
      const updated = res.data;
      set((state) => ({
        sponsors: state.sponsors.map((s) =>
          s.id === id ? (updated as Sponsor) : s,
        ),
        saving: false,
      }));
      return true;
    }
    set({ saving: false });
    return false;
  },

  deleteSponsor: async (id: string) => {
    set({ saving: true });
    const res = await apiDeleteSponsor(id);
    if (res.status === 204) {
      set((state) => ({
        sponsors: state.sponsors.filter((s) => s.id !== id),
        saving: false,
      }));
      return true;
    }
    set({ saving: false });
    return false;
  },

  uploadLogo: async (sponsorId: string, file: File) => {
    const base64 = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const result = reader.result as string;
        const base64Data = result.split(",")[1];
        resolve(base64Data);
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });

    const res = await uploadSponsorLogo(sponsorId, base64, file.type);
    if (res.status === 200 && res.data) {
      set((state) => ({
        sponsors: state.sponsors.map((s) =>
          s.id === sponsorId ? (res.data as Sponsor) : s,
        ),
      }));
      return { success: true };
    }
    return null;
  },
}));
