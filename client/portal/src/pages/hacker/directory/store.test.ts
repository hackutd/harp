import { beforeEach, describe, expect, it, vi } from "vitest";

import { useDirectoryStore } from "./store";
import { directoryCard } from "./testFixtures";

const api = vi.hoisted(() => ({
  addContact: vi.fn(),
  fetchDirectory: vi.fn(),
  fetchDirectoryContacts: vi.fn(),
  fetchDirectoryMe: vi.fn(),
  fetchDirectoryPokes: vi.fn(),
  fetchSentPokes: vi.fn(),
  fetchUnseenPokes: vi.fn(),
  hideAttendee: vi.fn(),
  markPokesSeen: vi.fn(),
  pokeAttendee: vi.fn(),
  removeContact: vi.fn(),
  unhideAttendee: vi.fn(),
}));
vi.mock("./api", () => api);

const toast = vi.hoisted(() =>
  Object.assign(vi.fn(), { success: vi.fn(), error: vi.fn() }),
);
vi.mock("sonner", () => ({ toast }));

beforeEach(() => {
  useDirectoryStore.setState(useDirectoryStore.getInitialState(), true);
});

describe("fetchCards", () => {
  it("loads a page and its cursor", async () => {
    api.fetchDirectory.mockResolvedValue({
      status: 200,
      data: { cards: [directoryCard()], next_cursor: "c1", event_near: false },
    });

    const p = useDirectoryStore.getState().fetchCards();
    expect(useDirectoryStore.getState().loading).toBe(true);
    await p;

    const s = useDirectoryStore.getState();
    expect(s.cards.map((c) => c.user_id)).toEqual(["u-2"]);
    expect(s.nextCursor).toBe("c1");
    expect(s.loading).toBe(false);
  });

  it("drops a response that lands after newer filters", async () => {
    let resolveOld!: (v: unknown) => void;
    api.fetchDirectory
      .mockReturnValueOnce(new Promise((r) => (resolveOld = r)))
      .mockResolvedValueOnce({
        status: 200,
        data: {
          cards: [directoryCard({ user_id: "new" })],
          next_cursor: null,
          event_near: false,
        },
      });

    const older = useDirectoryStore.getState().fetchCards();
    await useDirectoryStore.getState().fetchCards();
    resolveOld({
      status: 200,
      data: {
        cards: [directoryCard({ user_id: "old" })],
        next_cursor: null,
        event_near: false,
      },
    });
    await older;

    expect(useDirectoryStore.getState().cards.map((c) => c.user_id)).toEqual([
      "new",
    ]);
  });

  it("clears the list and toasts on failure", async () => {
    useDirectoryStore.setState({ cards: [directoryCard()] });
    api.fetchDirectory.mockResolvedValue({ status: 403, error: "no card" });

    await useDirectoryStore.getState().fetchCards();

    expect(useDirectoryStore.getState().cards).toEqual([]);
    expect(toast.error).toHaveBeenCalledWith("no card");
  });
});

describe("fetchMore", () => {
  it("appends without duplicating cards", async () => {
    useDirectoryStore.setState({
      cards: [directoryCard({ user_id: "a" })],
      nextCursor: "c1",
    });
    api.fetchDirectory.mockResolvedValue({
      status: 200,
      data: {
        cards: [
          directoryCard({ user_id: "a" }),
          directoryCard({ user_id: "b" }),
        ],
        next_cursor: null,
        event_near: false,
      },
    });

    await useDirectoryStore.getState().fetchMore();

    expect(api.fetchDirectory).toHaveBeenCalledWith(expect.anything(), "c1");
    const s = useDirectoryStore.getState();
    expect(s.cards.map((c) => c.user_id)).toEqual(["a", "b"]);
    expect(s.nextCursor).toBeNull();
  });

  it("drops a page that lands after the filters changed, and can load more again", async () => {
    useDirectoryStore.setState({
      cards: [directoryCard({ user_id: "a" })],
      nextCursor: "c1",
    });
    let resolveMore!: (v: unknown) => void;
    api.fetchDirectory
      .mockReturnValueOnce(new Promise((r) => (resolveMore = r)))
      .mockResolvedValueOnce({
        status: 200,
        data: {
          cards: [directoryCard({ user_id: "filtered" })],
          next_cursor: "f1",
          event_near: false,
        },
      });

    const more = useDirectoryStore.getState().fetchMore();
    expect(useDirectoryStore.getState().loadingMore).toBe(true);
    await useDirectoryStore.getState().fetchCards();
    resolveMore({
      status: 200,
      data: {
        cards: [directoryCard({ user_id: "stale" })],
        next_cursor: "c2",
        event_near: false,
      },
    });
    await more;

    let s = useDirectoryStore.getState();
    expect(s.cards.map((c) => c.user_id)).toEqual(["filtered"]);
    expect(s.nextCursor).toBe("f1");
    expect(s.loadingMore).toBe(false);

    api.fetchDirectory.mockResolvedValueOnce({
      status: 200,
      data: {
        cards: [directoryCard({ user_id: "next" })],
        next_cursor: null,
        event_near: false,
      },
    });
    await useDirectoryStore.getState().fetchMore();

    s = useDirectoryStore.getState();
    expect(api.fetchDirectory).toHaveBeenLastCalledWith(
      expect.anything(),
      "f1",
    );
    expect(s.cards.map((c) => c.user_id)).toEqual(["filtered", "next"]);
  });

  it("keeps the list and clears the flag on failure", async () => {
    useDirectoryStore.setState({
      cards: [directoryCard({ user_id: "a" })],
      nextCursor: "c1",
    });
    api.fetchDirectory.mockResolvedValue({ status: 500, error: "boom" });

    await useDirectoryStore.getState().fetchMore();

    const s = useDirectoryStore.getState();
    expect(s.cards.map((c) => c.user_id)).toEqual(["a"]);
    expect(s.nextCursor).toBe("c1");
    expect(s.loadingMore).toBe(false);
    expect(toast.error).toHaveBeenCalledWith("boom");
  });

  it("does nothing without a cursor", async () => {
    await useDirectoryStore.getState().fetchMore();
    expect(api.fetchDirectory).not.toHaveBeenCalled();
  });
});

function page(ids: string[], next: string | null) {
  return {
    status: 200,
    data: {
      cards: ids.map((user_id) => directoryCard({ user_id })),
      next_cursor: next,
      event_near: false,
    },
  };
}

describe("goToPage", () => {
  it("steps forward and back through the cursors it has seen", async () => {
    api.fetchDirectory
      .mockResolvedValueOnce(page(["a"], "c2"))
      .mockResolvedValueOnce(page(["b"], "c3"))
      .mockResolvedValueOnce(page(["c"], null))
      .mockResolvedValueOnce(page(["b"], "c3"));
    const store = useDirectoryStore.getState();

    await store.fetchCards();
    await store.goToPage("next");
    await store.goToPage("next");
    let s = useDirectoryStore.getState();
    expect(s.cards.map((c) => c.user_id)).toEqual(["c"]);
    expect(s.pageCursors).toEqual([null, "c2", "c3"]);
    expect(s.nextCursor).toBeNull();

    await store.goToPage("prev");
    s = useDirectoryStore.getState();
    expect(api.fetchDirectory).toHaveBeenLastCalledWith(
      expect.anything(),
      "c2",
    );
    expect(s.cards.map((c) => c.user_id)).toEqual(["b"]);
    expect(s.pageCursors).toEqual([null, "c2"]);
  });

  it("does nothing past either end", async () => {
    await useDirectoryStore.getState().goToPage("prev");
    await useDirectoryStore.getState().goToPage("next");
    expect(api.fetchDirectory).not.toHaveBeenCalled();
  });

  it("stays on the current page on failure", async () => {
    useDirectoryStore.setState({
      cards: [directoryCard({ user_id: "a" })],
      nextCursor: "c2",
    });
    api.fetchDirectory.mockResolvedValue({ status: 500, error: "boom" });

    await useDirectoryStore.getState().goToPage("next");

    const s = useDirectoryStore.getState();
    expect(s.cards.map((c) => c.user_id)).toEqual(["a"]);
    expect(s.pageCursors).toEqual([null]);
    expect(s.nextCursor).toBe("c2");
    expect(s.loading).toBe(false);
    expect(toast.error).toHaveBeenCalledWith("boom");
  });

  it("is reset to page 1 by a fresh fetch", async () => {
    useDirectoryStore.setState({ pageCursors: [null, "c2", "c3"] });
    api.fetchDirectory.mockResolvedValue(page(["a"], "c2"));

    await useDirectoryStore.getState().fetchCards();

    expect(useDirectoryStore.getState().pageCursors).toEqual([null]);
  });
});

describe("fetchCards abort", () => {
  it("ignores an aborted request", async () => {
    useDirectoryStore.setState({ cards: [directoryCard({ user_id: "keep" })] });
    api.fetchDirectory.mockResolvedValue({
      status: 200,
      data: {
        cards: [directoryCard({ user_id: "new" })],
        next_cursor: null,
        event_near: false,
      },
    });
    const controller = new AbortController();
    controller.abort();

    await useDirectoryStore.getState().fetchCards(controller.signal);

    expect(useDirectoryStore.getState().cards.map((c) => c.user_id)).toEqual([
      "keep",
    ]);
  });
});

describe("fetchContacts", () => {
  it("loads cards and clears loading", async () => {
    api.fetchDirectoryContacts.mockResolvedValue({
      status: 200,
      data: { cards: [directoryCard({ user_id: "p" })] },
    });

    const p = useDirectoryStore.getState().fetchContacts();
    expect(useDirectoryStore.getState().contactsLoading).toBe(true);
    await p;

    const s = useDirectoryStore.getState();
    expect(s.contacts.map((c) => c.user_id)).toEqual(["p"]);
    expect(s.contactsLoading).toBe(false);
  });

  it("clears the list and toasts on failure", async () => {
    useDirectoryStore.setState({ contacts: [directoryCard()] });
    api.fetchDirectoryContacts.mockResolvedValue({
      status: 403,
      error: "no card",
    });

    await useDirectoryStore.getState().fetchContacts();

    const s = useDirectoryStore.getState();
    expect(s.contacts).toEqual([]);
    expect(s.contactsLoading).toBe(false);
    expect(toast.error).toHaveBeenCalledWith("no card");
  });

  it("ignores an aborted request", async () => {
    useDirectoryStore.setState({
      contacts: [directoryCard({ user_id: "keep" })],
    });
    api.fetchDirectoryContacts.mockResolvedValue({
      status: 200,
      data: { cards: [directoryCard({ user_id: "new" })] },
    });
    const controller = new AbortController();
    controller.abort();

    await useDirectoryStore.getState().fetchContacts(controller.signal);

    expect(useDirectoryStore.getState().contacts.map((c) => c.user_id)).toEqual(
      ["keep"],
    );
  });
});

describe("fetchPokes", () => {
  const ok = (id: string) => ({
    status: 200,
    data: { cards: [directoryCard({ user_id: id })] },
  });

  it("loads both directions and clears loading", async () => {
    api.fetchDirectoryPokes.mockResolvedValue(ok("in"));
    api.fetchSentPokes.mockResolvedValue(ok("out"));

    const p = useDirectoryStore.getState().fetchPokes();
    expect(useDirectoryStore.getState().pokesLoading).toBe(true);
    await p;

    const s = useDirectoryStore.getState();
    expect(s.pokes.map((c) => c.user_id)).toEqual(["in"]);
    expect(s.sentPokes.map((c) => c.user_id)).toEqual(["out"]);
    expect(s.pokesLoading).toBe(false);
  });

  it.each([
    ["received", "fetchDirectoryPokes", "fetchSentPokes"],
    ["sent", "fetchSentPokes", "fetchDirectoryPokes"],
  ] as const)(
    "clears both lists and toasts when the %s list fails",
    async (_, failing, working) => {
      useDirectoryStore.setState({
        pokes: [directoryCard()],
        sentPokes: [directoryCard()],
      });
      api[failing].mockResolvedValue({ status: 403, error: "no card" });
      api[working].mockResolvedValue(ok("p"));

      await useDirectoryStore.getState().fetchPokes();

      const s = useDirectoryStore.getState();
      expect(s.pokes).toEqual([]);
      expect(s.sentPokes).toEqual([]);
      expect(s.pokesLoading).toBe(false);
      expect(toast.error).toHaveBeenCalledTimes(1);
      expect(toast.error).toHaveBeenCalledWith("no card");
    },
  );

  it("ignores an aborted request", async () => {
    useDirectoryStore.setState({
      pokes: [directoryCard({ user_id: "keep" })],
      sentPokes: [directoryCard({ user_id: "keep" })],
    });
    api.fetchDirectoryPokes.mockResolvedValue(ok("new"));
    api.fetchSentPokes.mockResolvedValue(ok("new"));
    const controller = new AbortController();
    controller.abort();

    await useDirectoryStore.getState().fetchPokes(controller.signal);

    const s = useDirectoryStore.getState();
    expect(s.pokes.map((c) => c.user_id)).toEqual(["keep"]);
    expect(s.sentPokes.map((c) => c.user_id)).toEqual(["keep"]);
  });
});

describe("poke", () => {
  it("marks the card poked and saves it to contacts", async () => {
    useDirectoryStore.setState({ cards: [directoryCard()] });
    api.pokeAttendee.mockResolvedValue({
      status: 200,
      data: {
        matched: false,
        card: directoryCard({ poked_by_me: true, is_contact: true }),
      },
    });

    expect(await useDirectoryStore.getState().poke(directoryCard())).toBe(true);

    const s = useDirectoryStore.getState();
    expect(s.cards[0].poked_by_me).toBe(true);
    expect(s.sentPokes.map((c) => c.user_id)).toEqual(["u-2"]);
    expect(s.contacts.map((c) => c.user_id)).toEqual(["u-2"]);
    expect(s.newMatch).toBeNull();
    expect(s.busy).toEqual({});
    expect(toast.success).toHaveBeenCalledWith(
      "Poked Bob Builder",
      expect.anything(),
    );
  });

  it("announces a match and reveals Discord across lists", async () => {
    const pokedMe = directoryCard({ poked_me: true });
    useDirectoryStore.setState({ pokes: [pokedMe] });
    api.pokeAttendee.mockResolvedValue({
      status: 200,
      data: {
        matched: true,
        card: directoryCard({ matched: true, discord_username: "bob" }),
      },
    });

    await useDirectoryStore.getState().poke(pokedMe);

    const s = useDirectoryStore.getState();
    expect(s.pokes[0].matched).toBe(true);
    expect(s.pokes[0].discord_username).toBe("bob");
    expect(s.sentPokes.map((c) => c.user_id)).toEqual(["u-2"]);
    expect(s.newMatch?.user_id).toBe("u-2");
    expect(toast.success).not.toHaveBeenCalled();

    useDirectoryStore.getState().dismissMatch();
    expect(useDirectoryStore.getState().newMatch).toBeNull();
  });

  it("surfaces a rejected poke", async () => {
    api.pokeAttendee.mockResolvedValue({
      status: 403,
      error: "this attendee isn't accepting pokes or contact adds",
    });

    expect(await useDirectoryStore.getState().poke(directoryCard())).toBe(
      false,
    );
    expect(toast.error).toHaveBeenCalled();
    expect(useDirectoryStore.getState().contacts).toEqual([]);
  });
});

describe("toggleContact", () => {
  it("removes a saved contact from the contacts list", async () => {
    const saved = directoryCard({ is_contact: true });
    useDirectoryStore.setState({ cards: [saved], contacts: [saved] });
    api.removeContact.mockResolvedValue({ status: 204 });

    await useDirectoryStore.getState().toggleContact(saved);

    const s = useDirectoryStore.getState();
    expect(s.contacts).toEqual([]);
    expect(s.cards[0].is_contact).toBe(false);
  });

  it("adds a contact", async () => {
    useDirectoryStore.setState({ cards: [directoryCard()] });
    api.addContact.mockResolvedValue({
      status: 200,
      data: { card: directoryCard({ is_contact: true }) },
    });

    await useDirectoryStore.getState().toggleContact(directoryCard());

    const s = useDirectoryStore.getState();
    expect(s.cards[0].is_contact).toBe(true);
    expect(s.contacts).toHaveLength(1);
  });
});

describe("hide / unhide", () => {
  it("hides a card and undo puts it back in place", async () => {
    const cards = ["a", "b", "c"].map((id) => directoryCard({ user_id: id }));
    useDirectoryStore.setState({ cards });
    api.hideAttendee.mockResolvedValue({ status: 204 });
    api.unhideAttendee.mockResolvedValue({ status: 204 });

    await useDirectoryStore.getState().hide(cards[1]);
    expect(useDirectoryStore.getState().cards.map((c) => c.user_id)).toEqual([
      "a",
      "c",
    ]);

    const undo = toast.mock.calls[0][1].action.onClick;
    undo();
    await vi.waitFor(() =>
      expect(useDirectoryStore.getState().cards.map((c) => c.user_id)).toEqual([
        "a",
        "b",
        "c",
      ]),
    );
    expect(api.unhideAttendee).toHaveBeenCalledWith("b");
  });

  it("drops an unhidden card from the hidden view", async () => {
    const hidden = directoryCard({ is_hidden: true });
    useDirectoryStore.setState({
      cards: [hidden],
      filters: { ...useDirectoryStore.getState().filters, hidden: true },
    });
    api.unhideAttendee.mockResolvedValue({ status: 204 });

    await useDirectoryStore.getState().unhide(hidden);

    expect(useDirectoryStore.getState().cards).toEqual([]);
  });

  it("keeps the card when hiding fails", async () => {
    useDirectoryStore.setState({ cards: [directoryCard()] });
    api.hideAttendee.mockResolvedValue({ status: 500, error: "boom" });

    await useDirectoryStore.getState().hide(directoryCard());

    expect(useDirectoryStore.getState().cards).toHaveLength(1);
    expect(toast.error).toHaveBeenCalledWith("boom");
  });
});

describe("unseen pokes", () => {
  const unseen = {
    count: 2,
    pokers: [{ user_id: "u-2", display_name: "Bob", headshot_url: null }],
  };

  it("marks seen through the newest poke shown and clears the badge", async () => {
    api.markPokesSeen.mockResolvedValue({ status: 204 });
    useDirectoryStore.setState({
      unseenPokes: unseen,
      pokes: [
        directoryCard({
          user_id: "u-3",
          related_at: "2026-11-14T18:30:00.123456Z",
        }),
        directoryCard({ user_id: "u-2", related_at: "2026-11-14T18:00:00Z" }),
      ],
    });

    await useDirectoryStore.getState().markPokesSeen();

    expect(api.markPokesSeen).toHaveBeenCalledWith(
      "2026-11-14T18:30:00.123456Z",
    );
    expect(useDirectoryStore.getState().unseenPokes?.count).toBe(0);
  });

  it("does nothing with no pokes", async () => {
    await useDirectoryStore.getState().markPokesSeen();
    expect(api.markPokesSeen).not.toHaveBeenCalled();
  });

  it("drops a count fetched before the pokes were marked seen", async () => {
    let resolveOld!: (v: unknown) => void;
    api.fetchUnseenPokes.mockReturnValueOnce(
      new Promise((r) => (resolveOld = r)),
    );
    api.markPokesSeen.mockResolvedValue({ status: 204 });
    useDirectoryStore.setState({
      pokes: [directoryCard({ related_at: "2026-11-14T18:00:00Z" })],
    });

    const older = useDirectoryStore.getState().fetchUnseenPokes();
    await useDirectoryStore.getState().markPokesSeen();
    resolveOld({ status: 200, data: unseen });
    await older;

    expect(useDirectoryStore.getState().unseenPokes?.count).toBe(0);
  });
});
