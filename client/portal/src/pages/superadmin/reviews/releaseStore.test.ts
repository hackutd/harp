import { beforeEach, describe, expect, it, vi } from "vitest";

import { useDecisionReleaseStore } from "./releaseStore";

const api = vi.hoisted(() => ({
  fetchDecisionsReleased: vi.fn(),
  setDecisionsReleased: vi.fn(),
}));
vi.mock("./api", () => ({
  fetchDecisionsReleased: api.fetchDecisionsReleased,
  setDecisionsReleased: api.setDecisionsReleased,
}));

const sharedApi = vi.hoisted(() => ({ errorAlert: vi.fn() }));
vi.mock("@/shared/lib/api", () => ({ errorAlert: sharedApi.errorAlert }));

const toast = vi.hoisted(() => ({ success: vi.fn() }));
vi.mock("sonner", () => ({ toast }));

beforeEach(() => {
  useDecisionReleaseStore.setState(
    useDecisionReleaseStore.getInitialState(),
    true,
  );
});

describe("fetchReleased", () => {
  it("loads the release state and clears loading", async () => {
    api.fetchDecisionsReleased.mockResolvedValue({
      status: 200,
      data: { released: true },
    });

    await useDecisionReleaseStore.getState().fetchReleased();

    const state = useDecisionReleaseStore.getState();
    expect(state.released).toBe(true);
    expect(state.loading).toBe(false);
    expect(state.error).toBeNull();
  });

  it("keeps released unknown and records the error on failure", async () => {
    api.fetchDecisionsReleased.mockResolvedValue({
      status: 500,
      error: "boom",
    });

    await useDecisionReleaseStore.getState().fetchReleased();

    const state = useDecisionReleaseStore.getState();
    expect(state.released).toBeNull();
    expect(state.loading).toBe(false);
    expect(state.error).toBe("boom");
  });

  it("ignores a response that lands after the request was aborted", async () => {
    const controller = new AbortController();
    api.fetchDecisionsReleased.mockImplementation(async () => {
      controller.abort();
      return { status: 200, data: { released: true } };
    });

    await useDecisionReleaseStore.getState().fetchReleased(controller.signal);

    expect(useDecisionReleaseStore.getState().released).toBeNull();
  });

  it("drops a load that resolves after a save already answered", async () => {
    let resolveLoad!: (value: unknown) => void;
    api.fetchDecisionsReleased.mockReturnValue(
      new Promise((resolve) => {
        resolveLoad = resolve;
      }),
    );
    api.setDecisionsReleased.mockResolvedValue({
      status: 200,
      data: { released: true },
    });

    const load = useDecisionReleaseStore.getState().fetchReleased();
    await useDecisionReleaseStore.getState().setReleased(true);
    resolveLoad({ status: 200, data: { released: false } });
    await load;

    expect(useDecisionReleaseStore.getState().released).toBe(true);
  });
});

describe("setReleased", () => {
  it.each([
    [true, "Decisions released. Hackers can now see their results."],
    [false, "Decisions hidden. Hackers see their application as under review."],
  ])("saves released=%s and confirms with a toast", async (value, message) => {
    api.setDecisionsReleased.mockResolvedValue({
      status: 200,
      data: { released: value },
    });

    const ok = await useDecisionReleaseStore.getState().setReleased(value);

    expect(ok).toBe(true);
    expect(api.setDecisionsReleased).toHaveBeenCalledWith(value);
    const state = useDecisionReleaseStore.getState();
    expect(state.released).toBe(value);
    expect(state.saving).toBe(false);
    expect(toast.success).toHaveBeenCalledWith(message);
  });

  it("alerts and reloads the saved state when the save fails", async () => {
    useDecisionReleaseStore.setState({ released: false });
    const failure = { status: 500, error: "boom" };
    api.setDecisionsReleased.mockResolvedValue(failure);
    api.fetchDecisionsReleased.mockResolvedValue({
      status: 200,
      data: { released: true },
    });

    const ok = await useDecisionReleaseStore.getState().setReleased(true);

    expect(ok).toBe(false);
    expect(sharedApi.errorAlert).toHaveBeenCalledWith(failure);
    expect(toast.success).not.toHaveBeenCalled();
    expect(useDecisionReleaseStore.getState().saving).toBe(false);
    await vi.waitFor(() =>
      expect(useDecisionReleaseStore.getState().released).toBe(true),
    );
  });
});
