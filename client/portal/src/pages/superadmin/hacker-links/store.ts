import { create } from "zustand";

import { errorAlert } from "@/shared/lib/api";

import { fetchHackerPackURL, updateHackerPackURL } from "../settings/api";
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
  // Empty when no Notion embed is saved, which also hides the built-in
  // Hacker Pack card on the hacker home page.
  hackerPackURL: string;
  loading: boolean;
  saving: boolean;
  savingHackerPack: boolean;

  fetch: (signal?: AbortSignal) => Promise<void>;
  createLink: (payload: HackerLinkPayload) => Promise<string | null>;
  updateLink: (id: string, payload: HackerLinkPayload) => Promise<boolean>;
  deleteLink: (id: string) => Promise<boolean>;
  saveHackerPackURL: (url: string) => Promise<boolean>;
}

export const useHackerLinksStore = create<HackerLinksState>((set) => ({
  links: [],
  hackerPackURL: "",
  loading: false,
  saving: false,
  savingHackerPack: false,

  fetch: async (signal?: AbortSignal) => {
    set({ loading: true });

    const [linksRes, packRes] = await Promise.all([
      fetchHackerLinks(signal),
      fetchHackerPackURL(signal),
    ]);

    if (signal?.aborted) return;

    const links =
      linksRes.status === 200 && linksRes.data
        ? sortByOrder(linksRes.data.hacker_links)
        : [];
    const hackerPackURL =
      packRes.status === 200 && packRes.data ? packRes.data.url.trim() : "";

    set({ links, hackerPackURL, loading: false });
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

  saveHackerPackURL: async (url: string) => {
    set({ savingHackerPack: true });
    const res = await updateHackerPackURL(url);
    if (res.status === 200 && res.data) {
      set({ hackerPackURL: res.data.url.trim(), savingHackerPack: false });
      return true;
    }
    errorAlert(res);
    set({ savingHackerPack: false });
    return false;
  },
}));
