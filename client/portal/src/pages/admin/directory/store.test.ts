import { beforeEach, describe, expect, it, vi } from "vitest";

import { useDirectoryModerationStore } from "./store";
import { adminProfile } from "./testFixtures";

const api = vi.hoisted(() => ({
  fetchDirectoryProfiles: vi.fn(),
  moderateDirectoryProfile: vi.fn(),
}));
vi.mock("./api", () => api);

const toast = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn() }));
vi.mock("sonner", () => ({ toast }));

const store = useDirectoryModerationStore;

beforeEach(() => {
  store.setState(store.getInitialState(), true);
});

function page(ids: string[], next: string | null = null) {
  return {
    status: 200,
    data: {
      profiles: ids.map((id) => adminProfile({ user_id: id })),
      next_cursor: next,
    },
  };
}

describe("fetchProfiles", () => {
  it("loads a page for the current search", async () => {
    store.setState({ search: "bob" });
    api.fetchDirectoryProfiles.mockResolvedValue(page(["a"], "c1"));

    const p = store.getState().fetchProfiles();
    expect(store.getState().loading).toBe(true);
    await p;

    expect(api.fetchDirectoryProfiles).toHaveBeenCalledWith(
      "bob",
      null,
      undefined,
    );
    const s = store.getState();
    expect(s.profiles.map((p) => p.user_id)).toEqual(["a"]);
    expect(s.nextCursor).toBe("c1");
    expect(s.loading).toBe(false);
  });

  it("clears the list and alerts on failure", async () => {
    store.setState({ profiles: [adminProfile()] });
    api.fetchDirectoryProfiles.mockResolvedValue({
      status: 403,
      error: "forbidden",
    });

    await store.getState().fetchProfiles();

    expect(store.getState().profiles).toEqual([]);
    expect(store.getState().loading).toBe(false);
    expect(toast.error).toHaveBeenCalledWith("forbidden");
  });

  it("ignores an aborted request", async () => {
    store.setState({ profiles: [adminProfile({ user_id: "keep" })] });
    api.fetchDirectoryProfiles.mockResolvedValue(page(["new"]));
    const controller = new AbortController();
    controller.abort();

    await store.getState().fetchProfiles(controller.signal);

    expect(store.getState().profiles.map((p) => p.user_id)).toEqual(["keep"]);
  });

  it("drops a response that lands after a newer search", async () => {
    let resolveOld!: (v: unknown) => void;
    api.fetchDirectoryProfiles
      .mockReturnValueOnce(new Promise((r) => (resolveOld = r)))
      .mockResolvedValueOnce(page(["new"]));

    const older = store.getState().fetchProfiles();
    await store.getState().fetchProfiles();
    resolveOld(page(["old"]));
    await older;

    expect(store.getState().profiles.map((p) => p.user_id)).toEqual(["new"]);
    expect(store.getState().loading).toBe(false);
  });
});

describe("fetchMore", () => {
  it("appends the next page without duplicates", async () => {
    store.setState({
      profiles: [adminProfile({ user_id: "a" })],
      nextCursor: "c1",
    });
    api.fetchDirectoryProfiles.mockResolvedValue(page(["a", "b"]));

    await store.getState().fetchMore();

    expect(api.fetchDirectoryProfiles).toHaveBeenCalledWith("", "c1");
    const s = store.getState();
    expect(s.profiles.map((p) => p.user_id)).toEqual(["a", "b"]);
    expect(s.nextCursor).toBeNull();
    expect(s.loadingMore).toBe(false);
  });

  it("drops a page that lands after the search changed and can load more again", async () => {
    store.setState({
      profiles: [adminProfile({ user_id: "a" })],
      nextCursor: "c1",
    });
    let resolveMore!: (v: unknown) => void;
    api.fetchDirectoryProfiles
      .mockReturnValueOnce(new Promise((r) => (resolveMore = r)))
      .mockResolvedValueOnce(page(["searched"], "s1"));

    const more = store.getState().fetchMore();
    await store.getState().fetchProfiles();
    resolveMore(page(["stale"], "c2"));
    await more;

    const s = store.getState();
    expect(s.profiles.map((p) => p.user_id)).toEqual(["searched"]);
    expect(s.nextCursor).toBe("s1");
    expect(s.loadingMore).toBe(false);
  });

  it("keeps the list and clears the flag on failure", async () => {
    store.setState({
      profiles: [adminProfile({ user_id: "a" })],
      nextCursor: "c1",
    });
    api.fetchDirectoryProfiles.mockResolvedValue({
      status: 500,
      error: "boom",
    });

    await store.getState().fetchMore();

    const s = store.getState();
    expect(s.profiles.map((p) => p.user_id)).toEqual(["a"]);
    expect(s.loadingMore).toBe(false);
    expect(toast.error).toHaveBeenCalledWith("boom");
  });
});

describe("setModeration", () => {
  it("hides a card with a trimmed reason", async () => {
    const profile = adminProfile({ user_id: "a" });
    store.setState({ profiles: [profile] });
    api.moderateDirectoryProfile.mockResolvedValue({ status: 204 });

    const ok = await store.getState().setModeration(profile, true, "  spam ");

    expect(ok).toBe(true);
    expect(api.moderateDirectoryProfile).toHaveBeenCalledWith("a", {
      hidden: true,
      reason: "spam",
    });
    const [updated] = store.getState().profiles;
    expect(updated.moderation_hidden_at).not.toBeNull();
    expect(updated.moderation_reason).toBe("spam");
    expect(store.getState().saving).toEqual({});
    expect(toast.success).toHaveBeenCalledWith("Hid Bob Builder's card");
  });

  it("restores a card and clears the reason", async () => {
    const profile = adminProfile({
      user_id: "a",
      moderation_hidden_at: "2026-10-02T00:00:00Z",
      moderation_hidden_by: "admin-1",
      moderation_reason: "spam",
    });
    store.setState({ profiles: [profile] });
    api.moderateDirectoryProfile.mockResolvedValue({ status: 204 });

    await store.getState().setModeration(profile, false, "ignored");

    expect(api.moderateDirectoryProfile).toHaveBeenCalledWith("a", {
      hidden: false,
      reason: null,
    });
    const [updated] = store.getState().profiles;
    expect(updated.moderation_hidden_at).toBeNull();
    expect(updated.moderation_hidden_by).toBeNull();
    expect(updated.moderation_reason).toBeNull();
  });

  it("leaves the card alone when the request fails", async () => {
    const profile = adminProfile({ user_id: "a" });
    store.setState({ profiles: [profile] });
    api.moderateDirectoryProfile.mockResolvedValue({
      status: 404,
      error: "directory card not found",
    });

    const ok = await store.getState().setModeration(profile, true);

    expect(ok).toBe(false);
    expect(store.getState().profiles[0].moderation_hidden_at).toBeNull();
    expect(store.getState().saving).toEqual({});
    expect(toast.error).toHaveBeenCalledWith("directory card not found");
  });

  it("ignores a second click while the first is saving", async () => {
    const profile = adminProfile({ user_id: "a" });
    store.setState({ profiles: [profile], saving: { a: true } });

    const ok = await store.getState().setModeration(profile, true);

    expect(ok).toBe(false);
    expect(api.moderateDirectoryProfile).not.toHaveBeenCalled();
  });
});
