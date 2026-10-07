import { toast } from "sonner";
import { create } from "zustand";

import { errorAlert } from "@/shared/lib/api";

import {
  addContact,
  fetchDirectory,
  fetchDirectoryContacts,
  fetchDirectoryMe,
  fetchDirectoryPokes,
  hideAttendee,
  pokeAttendee,
  removeContact,
  unhideAttendee,
} from "./api";
import type { DirectoryCardData, DirectoryFilters, DirectoryMe } from "./types";

export const EMPTY_FILTERS: DirectoryFilters = {
  intents: [],
  tags: [],
  q: "",
  checkedIn: false,
  hidden: false,
};

interface DirectoryState {
  me: DirectoryMe | null;
  meLoading: boolean;
  filters: DirectoryFilters;
  cards: DirectoryCardData[];
  nextCursor: string | null;
  loading: boolean;
  loadingMore: boolean;
  pokes: DirectoryCardData[];
  pokesLoading: boolean;
  contacts: DirectoryCardData[];
  contactsLoading: boolean;
  busy: Record<string, boolean>;

  fetchMe: (signal?: AbortSignal) => Promise<void>;
  setMe: (me: DirectoryMe) => void;
  setFilters: (patch: Partial<DirectoryFilters>) => void;
  fetchCards: (signal?: AbortSignal) => Promise<void>;
  fetchMore: () => Promise<void>;
  fetchPokes: (signal?: AbortSignal) => Promise<void>;
  fetchContacts: (signal?: AbortSignal) => Promise<void>;
  poke: (card: DirectoryCardData) => Promise<boolean>;
  toggleContact: (card: DirectoryCardData) => Promise<void>;
  hide: (card: DirectoryCardData) => Promise<void>;
  unhide: (card: DirectoryCardData, restoreAt?: number) => Promise<void>;
}

// Guards against a slow page of results landing after the filters changed.
let listSeq = 0;

type Lists = Pick<DirectoryState, "cards" | "pokes" | "contacts">;

function patchLists(
  s: Lists,
  userID: string,
  patch: (c: DirectoryCardData) => DirectoryCardData,
): Lists {
  const apply = (list: DirectoryCardData[]) =>
    list.map((c) => (c.user_id === userID ? patch(c) : c));
  return {
    cards: apply(s.cards),
    pokes: apply(s.pokes),
    contacts: apply(s.contacts),
  };
}

export const useDirectoryStore = create<DirectoryState>((set, get) => {
  const setBusy = (id: string, value: boolean) =>
    set((s) => {
      const busy = { ...s.busy };
      if (value) busy[id] = true;
      else delete busy[id];
      return { busy };
    });

  return {
    me: null,
    meLoading: true,
    filters: EMPTY_FILTERS,
    cards: [],
    nextCursor: null,
    loading: false,
    loadingMore: false,
    pokes: [],
    pokesLoading: false,
    contacts: [],
    contactsLoading: false,
    busy: {},

    fetchMe: async (signal) => {
      const res = await fetchDirectoryMe(signal);
      if (signal?.aborted) return;
      if (res.status === 200 && res.data) {
        set({ me: res.data, meLoading: false });
      } else {
        set({ meLoading: false });
        errorAlert(res);
      }
    },

    setMe: (me) => set({ me }),

    setFilters: (patch) =>
      set((s) => ({ filters: { ...s.filters, ...patch } })),

    fetchCards: async (signal) => {
      const seq = ++listSeq;
      set({ loading: true });
      const res = await fetchDirectory(get().filters, null, signal);
      if (signal?.aborted || seq !== listSeq) return;
      if (res.status === 200 && res.data) {
        set({
          cards: res.data.cards,
          nextCursor: res.data.next_cursor,
          loading: false,
        });
      } else {
        set({ cards: [], nextCursor: null, loading: false });
        errorAlert(res);
      }
    },

    fetchMore: async () => {
      const { nextCursor, loadingMore, filters } = get();
      if (!nextCursor || loadingMore) return;
      const seq = listSeq;
      set({ loadingMore: true });
      const res = await fetchDirectory(filters, nextCursor);
      if (seq !== listSeq) return;
      if (res.status === 200 && res.data) {
        const page = res.data;
        set((s) => {
          const seen = new Set(s.cards.map((c) => c.user_id));
          return {
            cards: [
              ...s.cards,
              ...page.cards.filter((c) => !seen.has(c.user_id)),
            ],
            nextCursor: page.next_cursor,
            loadingMore: false,
          };
        });
      } else {
        set({ loadingMore: false });
        errorAlert(res);
      }
    },

    fetchPokes: async (signal) => {
      set({ pokesLoading: true });
      const res = await fetchDirectoryPokes(signal);
      if (signal?.aborted) return;
      set({
        pokes: res.status === 200 && res.data ? res.data.cards : [],
        pokesLoading: false,
      });
      if (res.status !== 200) errorAlert(res);
    },

    fetchContacts: async (signal) => {
      set({ contactsLoading: true });
      const res = await fetchDirectoryContacts(signal);
      if (signal?.aborted) return;
      set({
        contacts: res.status === 200 && res.data ? res.data.cards : [],
        contactsLoading: false,
      });
      if (res.status !== 200) errorAlert(res);
    },

    poke: async (card) => {
      if (get().busy[card.user_id]) return false;
      setBusy(card.user_id, true);
      const res = await pokeAttendee(card.user_id);
      setBusy(card.user_id, false);
      if (res.status !== 200 || !res.data) {
        errorAlert(res);
        return false;
      }
      const { card: updated, matched } = res.data;
      set((s) => {
        const lists = patchLists(s, updated.user_id, (c) => ({
          ...updated,
          is_hidden: c.is_hidden,
        }));
        const saved = lists.contacts.some((c) => c.user_id === updated.user_id);
        return {
          ...lists,
          contacts: saved ? lists.contacts : [updated, ...lists.contacts],
        };
      });
      if (matched) {
        toast.success(`You and ${updated.display_name} matched`, {
          description: "Their Discord is on the card now.",
        });
      } else {
        toast.success(`Poked ${updated.display_name}`, {
          description: "Saved to your contacts.",
        });
      }
      return true;
    },

    toggleContact: async (card) => {
      if (get().busy[card.user_id]) return;
      setBusy(card.user_id, true);
      if (card.is_contact) {
        const res = await removeContact(card.user_id);
        setBusy(card.user_id, false);
        if (res.status !== 204 && res.status !== 200) {
          errorAlert(res);
          return;
        }
        set((s) => {
          const lists = patchLists(s, card.user_id, (c) => ({
            ...c,
            is_contact: false,
          }));
          return {
            ...lists,
            contacts: lists.contacts.filter((c) => c.user_id !== card.user_id),
          };
        });
        return;
      }
      const res = await addContact(card.user_id);
      setBusy(card.user_id, false);
      if (res.status !== 200 || !res.data) {
        errorAlert(res);
        return;
      }
      const updated = res.data.card;
      set((s) => {
        const lists = patchLists(s, card.user_id, (c) => ({
          ...c,
          is_contact: true,
        }));
        const saved = lists.contacts.some((c) => c.user_id === card.user_id);
        return {
          ...lists,
          contacts: saved ? lists.contacts : [updated, ...lists.contacts],
        };
      });
      toast.success(`Saved ${card.display_name} to your contacts`);
    },

    hide: async (card) => {
      if (get().busy[card.user_id]) return;
      setBusy(card.user_id, true);
      const res = await hideAttendee(card.user_id);
      setBusy(card.user_id, false);
      if (res.status !== 204 && res.status !== 200) {
        errorAlert(res);
        return;
      }
      const index = get().cards.findIndex((c) => c.user_id === card.user_id);
      set((s) => ({
        cards: s.cards.filter((c) => c.user_id !== card.user_id),
      }));
      toast(`Hid ${card.display_name}`, {
        description: "Find them again under the Hidden filter.",
        action: {
          label: "Undo",
          onClick: () => {
            void get().unhide({ ...card, is_hidden: true }, index);
          },
        },
      });
    },

    unhide: async (card, restoreAt) => {
      if (get().busy[card.user_id]) return;
      setBusy(card.user_id, true);
      const res = await unhideAttendee(card.user_id);
      setBusy(card.user_id, false);
      if (res.status !== 204 && res.status !== 200) {
        errorAlert(res);
        return;
      }
      set((s) => {
        if (s.filters.hidden) {
          return { cards: s.cards.filter((c) => c.user_id !== card.user_id) };
        }
        if (restoreAt === undefined || restoreAt < 0) return {};
        if (s.cards.some((c) => c.user_id === card.user_id)) return {};
        const cards = [...s.cards];
        cards.splice(Math.min(restoreAt, cards.length), 0, {
          ...card,
          is_hidden: false,
        });
        return { cards };
      });
    },
  };
});
