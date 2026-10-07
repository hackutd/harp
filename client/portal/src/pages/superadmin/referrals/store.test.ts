import { beforeEach, describe, expect, it, vi } from "vitest";

import { useReferralsStore } from "./store";
import type { Referral } from "./types";

const referralsApi = vi.hoisted(() => ({
  createReferral: vi.fn(),
  deleteReferral: vi.fn(),
  fetchReferrals: vi.fn(),
  updateReferral: vi.fn(),
}));
vi.mock("./api", () => referralsApi);

const toast = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn() }));
vi.mock("sonner", () => ({ toast }));

function makeReferral(id: string, overrides: Partial<Referral> = {}): Referral {
  return {
    id,
    name: "Kai Codes",
    code: "NbjlBgit",
    visit_count: 0,
    signup_count: 0,
    created_at: "2026-10-01T15:00:00Z",
    updated_at: "2026-10-01T15:00:00Z",
    ...overrides,
  };
}

beforeEach(() => {
  useReferralsStore.setState(useReferralsStore.getInitialState(), true);
});

describe("fetch", () => {
  it("loads referrals", async () => {
    referralsApi.fetchReferrals.mockResolvedValue({
      status: 200,
      data: { referrals: [makeReferral("r1")] },
    });

    await useReferralsStore.getState().fetch();

    const state = useReferralsStore.getState();
    expect(state.referrals.map((r) => r.id)).toEqual(["r1"]);
    expect(state.loading).toBe(false);
  });

  it("keeps the list and shows an error on failure", async () => {
    useReferralsStore.setState({ referrals: [makeReferral("r1")] });
    referralsApi.fetchReferrals.mockResolvedValue({
      status: 500,
      error: "db down",
    });

    await useReferralsStore.getState().fetch();

    expect(useReferralsStore.getState().referrals).toHaveLength(1);
    expect(useReferralsStore.getState().loading).toBe(false);
    expect(toast.error).toHaveBeenCalledWith("db down");
  });

  it("ignores an aborted response", async () => {
    const controller = new AbortController();
    referralsApi.fetchReferrals.mockImplementation(async () => {
      controller.abort();
      return { status: 200, data: { referrals: [makeReferral("r1")] } };
    });

    await useReferralsStore.getState().fetch(controller.signal);

    expect(useReferralsStore.getState().referrals).toEqual([]);
  });
});

describe("createReferral", () => {
  it("puts the new referral first", async () => {
    useReferralsStore.setState({ referrals: [makeReferral("old")] });
    const created = makeReferral("new", { code: "Xy12Ab34" });
    referralsApi.createReferral.mockResolvedValue({
      status: 201,
      data: created,
    });

    const result = await useReferralsStore
      .getState()
      .createReferral({ name: "Kai Codes" });

    expect(result).toEqual(created);
    expect(useReferralsStore.getState().referrals.map((r) => r.id)).toEqual([
      "new",
      "old",
    ]);
    expect(useReferralsStore.getState().saving).toBe(false);
  });

  it("returns null and shows the conflict", async () => {
    referralsApi.createReferral.mockResolvedValue({
      status: 409,
      error: 'code "kaicodes" is already in use',
    });

    const result = await useReferralsStore
      .getState()
      .createReferral({ name: "Kai Codes", code: "kaicodes" });

    expect(result).toBeNull();
    expect(toast.error).toHaveBeenCalledWith(
      'code "kaicodes" is already in use',
    );
  });
});

describe("updateReferral", () => {
  it("replaces the referral in place", async () => {
    useReferralsStore.setState({
      referrals: [makeReferral("r1"), makeReferral("r2")],
    });
    referralsApi.updateReferral.mockResolvedValue({
      status: 200,
      data: makeReferral("r1", { name: "Kai Codes TikTok" }),
    });

    const ok = await useReferralsStore
      .getState()
      .updateReferral("r1", { name: "Kai Codes TikTok", code: "NbjlBgit" });

    expect(ok).toBe(true);
    expect(useReferralsStore.getState().referrals.map((r) => r.name)).toEqual([
      "Kai Codes TikTok",
      "Kai Codes",
    ]);
  });
});

describe("deleteReferral", () => {
  it("removes the referral on 204", async () => {
    useReferralsStore.setState({
      referrals: [makeReferral("r1"), makeReferral("r2")],
    });
    referralsApi.deleteReferral.mockResolvedValue({ status: 204 });

    const ok = await useReferralsStore.getState().deleteReferral("r1");

    expect(ok).toBe(true);
    expect(useReferralsStore.getState().referrals.map((r) => r.id)).toEqual([
      "r2",
    ]);
  });

  it("keeps the referral when the delete fails", async () => {
    useReferralsStore.setState({ referrals: [makeReferral("r1")] });
    referralsApi.deleteReferral.mockResolvedValue({
      status: 404,
      error: "not found",
    });

    const ok = await useReferralsStore.getState().deleteReferral("r1");

    expect(ok).toBe(false);
    expect(useReferralsStore.getState().referrals).toHaveLength(1);
  });
});
