import { create } from "zustand";

import { errorAlert } from "@/shared/lib/api";

import {
  createHackerLink as apiCreateHackerLink,
  deleteHackerLink as apiDeleteHackerLink,
  fetchHackerLinks,
  updateHackerLink as apiUpdateHackerLink,
} from "./api";
import type { HackerLink, HackerLinkPayload } from "./types";

function sortByOrder(links: HackerLink[]): HackerLink[] {
  return [...links].sort((a, b) => a.display_order - b.display_order);
}

export interface HackerLinksState {
  links: HackerLink[];
  loading: boolean;
  saving: boolean;

  fetch: (signal?: AbortSignal) => Promise<void>;
  createLink: (payload: HackerLinkPayload) => Promise<string | null>;
  updateLink: (id: string, payload: HackerLinkPayload) => Promise<boolean>;
  deleteLink: (id: string) => Promise<boolean>;
}

export const useHackerLinksStore = create<HackerLinksState>((set) => ({
  links: [],
  loading: false,
  saving: false,

  fetch: async (signal?: AbortSignal) => {
    set({ loading: true });
    const res = await fetchHackerLinks(signal);
    if (signal?.aborted) return;
    const links =
      res.status === 200 && res.data ? sortByOrder(res.data.hacker_links) : [];
    set({ links, loading: false });
  },

  createLink: async (payload: HackerLinkPayload) => {
    set({ saving: true });
    const res = await apiCreateHackerLink(payload);
    if (res.status === 201 && res.data) {
      const created = res.data;
      set((state) => ({
        links: sortByOrder([...state.links, created]),
        saving: false,
      }));
      return created.id;
    }
    errorAlert(res);
    set({ saving: false });
    return null;
  },

  updateLink: async (id: string, payload: HackerLinkPayload) => {
    set({ saving: true });
    const res = await apiUpdateHackerLink(id, payload);
    if (res.status === 200 && res.data) {
      const updated = res.data;
      set((state) => ({
        links: sortByOrder(state.links.map((l) => (l.id === id ? updated : l))),
        saving: false,
      }));
      return true;
    }
    errorAlert(res);
    set({ saving: false });
    return false;
  },

  deleteLink: async (id: string) => {
    set({ saving: true });
    const res = await apiDeleteHackerLink(id);
    if (res.status === 204) {
      set((state) => ({
        links: state.links.filter((l) => l.id !== id),
        saving: false,
      }));
      return true;
    }
    errorAlert(res);
    set({ saving: false });
    return false;
  },
}));
