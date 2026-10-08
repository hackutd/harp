import { toast } from "sonner";
import { create } from "zustand";

import { errorAlert } from "@/shared/lib/api";

import {
  addContact,
  fetchDirectory,
  fetchDirectoryContacts,
  fetchDirectoryMe,
  fetchDirectoryPokes,
  fetchSentPokes,
  fetchUnseenPokes,
  hideAttendee,
  markPokesSeen,
  pokeAttendee,
  removeContact,
  unhideAttendee,
} from "./api";
import type {
  DirectoryCardData,
  DirectoryFilters,
  DirectoryMe,
  UnseenPokes,
} from "./types";

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
  // Visibility picked before the card exists (in the editor or on Profile),
  // sent along when the card is created.
  draftDiscoverable: boolean;
  filters: DirectoryFilters;
  cards: DirectoryCardData[];
  nextCursor: string | null;
  // The cursor each page of the grid was fetched with, page 1 first (null).
  // The API only hands back a next cursor, so this is how Prev finds its way.
  pageCursors: (string | null)[];
  loading: boolean;
  loadingMore: boolean;
  // Who poked the viewer, matches included, newest poke first.
  pokes: DirectoryCardData[];
  // Who the viewer poked, matches included, newest poke first.
  sentPokes: DirectoryCardData[];
  pokesLoading: boolean;
  unseenPokes: UnseenPokes | null;
  contacts: DirectoryCardData[];
  contactsLoading: boolean;
  busy: Record<string, boolean>;
  // The person a poke just matched with, for the celebration dialog.
  newMatch: DirectoryCardData | null;

  fetchMe: (signal?: AbortSignal) => Promise<void>;
  setMe: (me: DirectoryMe) => void;
  setDraftDiscoverable: (discoverable: boolean) => void;
  setFilters: (patch: Partial<DirectoryFilters>) => void;
  fetchCards: (signal?: AbortSignal) => Promise<void>;
  // Appends the next page; the swipe queue keeps itself topped up with it.
  fetchMore: () => Promise<void>;
  // Swaps the grid to the next or previous page.
  goToPage: (direction: "next" | "prev") => Promise<void>;
  fetchPokes: (signal?: AbortSignal) => Promise<void>;
  fetchUnseenPokes: (signal?: AbortSignal) => Promise<void>;
  markPokesSeen: () => Promise<void>;
  fetchContacts: (signal?: AbortSignal) => Promise<void>;
  poke: (card: DirectoryCardData) => Promise<boolean>;
  dismissMatch: () => void;
  toggleContact: (card: DirectoryCardData) => Promise<void>;
  hide: (card: DirectoryCardData) => Promise<void>;
  unhide: (card: DirectoryCardData, restoreAt?: number) => Promise<void>;
}

// Guards against a slow page of results landing after the filters changed.
let listSeq = 0;
// Guards against an unseen count fetched before markPokesSeen landing after it.
let unseenSeq = 0;

type Lists = Pick<DirectoryState, "cards" | "pokes" | "sentPokes" | "contacts">;

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
    sentPokes: apply(s.sentPokes),
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
    draftDiscoverable: true,
    filters: EMPTY_FILTERS,
    cards: [],
    nextCursor: null,
    pageCursors: [null],
    loading: false,
    loadingMore: false,
    pokes: [],
    sentPokes: [],
    pokesLoading: false,
    unseenPokes: null,
    contacts: [],
    contactsLoading: false,
    busy: {},
    newMatch: null,

    fetchMe: async (signal) => {
      // Flag every refresh, not just the first: a cached "not eligible" from
      // before the RSVP was confirmed must not be acted on while the fresh
      // answer is still in flight.
      set({ meLoading: true });
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
    setDraftDiscoverable: (draftDiscoverable) => set({ draftDiscoverable }),

    setFilters: (patch) =>
      set((s) => ({ filters: { ...s.filters, ...patch } })),

    fetchCards: async (signal) => {
      const seq = ++listSeq;
      set({ loading: true, loadingMore: false });
      const res = await fetchDirectory(get().filters, null, signal);
      if (signal?.aborted || seq !== listSeq) return;
      if (res.status === 200 && res.data) {
        set({
          cards: res.data.cards,
          nextCursor: res.data.next_cursor,
          pageCursors: [null],
          loading: false,
        });
      } else {
        set({
          cards: [],
          nextCursor: null,
          pageCursors: [null],
          loading: false,
        });
        errorAlert(res);
      }
    },

    fetchMore: async () => {
      const { nextCursor, loadingMore, filters } = get();
      if (!nextCursor || loadingMore) return;
      const seq = listSeq;
      set({ loadingMore: true });
      const res = await fetchDirectory(filters, nextCursor);
      if (seq !== listSeq) {
        // fetchCards replaced the list; drop this page but clear the flag so
        // the next "Load more" isn't blocked.
        set({ loadingMore: false });
        return;
      }
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

    goToPage: async (direction) => {
      const { nextCursor, pageCursors, loading, filters } = get();
      if (loading) return;
      const next = direction === "next";
      if (next ? !nextCursor : pageCursors.length < 2) return;
      const cursor = next ? nextCursor : pageCursors[pageCursors.length - 2];
      const seq = ++listSeq;
      set({ loading: true, loadingMore: false });
      const res = await fetchDirectory(filters, cursor);
      if (seq !== listSeq) return;
      if (res.status === 200 && res.data) {
        set({
          cards: res.data.cards,
          nextCursor: res.data.next_cursor,
          pageCursors: next
            ? [...pageCursors, cursor]
            : pageCursors.slice(0, -1),
          loading: false,
        });
      } else {
        // Stay on the page already showing.
        set({ loading: false });
        errorAlert(res);
      }
    },

    // Both directions load together so the page never shows one half.
    fetchPokes: async (signal) => {
      set({ pokesLoading: true });
      const [received, sent] = await Promise.all([
        fetchDirectoryPokes(signal),
        fetchSentPokes(signal),
      ]);
      if (signal?.aborted) return;
      const failed = [received, sent].find((res) => res.status !== 200);
      set({
        pokes: !failed && received.data ? received.data.cards : [],
        sentPokes: !failed && sent.data ? sent.data.cards : [],
        pokesLoading: false,
      });
      if (failed) errorAlert(failed);
    },

    // The badge is a nicety, so failures stay quiet rather than toasting.
    fetchUnseenPokes: async (signal) => {
      const seq = ++unseenSeq;
      const res = await fetchUnseenPokes(signal);
      if (signal?.aborted || seq !== unseenSeq) return;
      if (res.status === 200 && res.data) set({ unseenPokes: res.data });
    },

    // Marks every poke in the loaded list as seen. Pokes that arrived after
    // the list loaded stay unseen.
    markPokesSeen: async () => {
      const through = get().pokes[0]?.related_at;
      if (!through) return;
      unseenSeq++;
      set({ unseenPokes: { count: 0, pokers: [] } });
      await markPokesSeen(through);
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
        const has = (list: DirectoryCardData[]) =>
          list.some((c) => c.user_id === updated.user_id);
        return {
          ...lists,
          sentPokes: has(lists.sentPokes)
            ? lists.sentPokes
            : [updated, ...lists.sentPokes],
          contacts: has(lists.contacts)
            ? lists.contacts
            : [updated, ...lists.contacts],
        };
      });
      if (matched) {
        set({ newMatch: updated });
      } else {
        toast.success(`Poked ${updated.display_name}`, {
          description: "Saved to your contacts.",
        });
      }
      return true;
    },

    dismissMatch: () => set({ newMatch: null }),

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
