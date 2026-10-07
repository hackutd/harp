import { beforeEach, describe, expect, it, vi } from "vitest";

import { useDirectoryStore } from "./store";
import { directoryCard } from "./testFixtures";

const api = vi.hoisted(() => ({
  addContact: vi.fn(),
  fetchDirectory: vi.fn(),
  fetchDirectoryContacts: vi.fn(),
  fetchDirectoryMe: vi.fn(),
  fetchDirectoryPokes: vi.fn(),
  hideAttendee: vi.fn(),
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
    expect(s.contacts.map((c) => c.user_id)).toEqual(["u-2"]);
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
        card: directoryCard({ matched: true, discord_user_id: "42" }),
      },
    });

    await useDirectoryStore.getState().poke(pokedMe);

    expect(useDirectoryStore.getState().pokes[0].discord_user_id).toBe("42");
    expect(toast.success).toHaveBeenCalledWith(
      "You and Bob Builder matched",
      expect.anything(),
    );
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
