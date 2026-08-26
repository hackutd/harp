import { describe, expect, it, vi } from "vitest";

import { createApplicationsStore } from "./createStore";
import type { ApplicationSortBy, ApplicationStatus } from "./types";

const api = vi.hoisted(() => ({
  fetchApplications: vi.fn(),
  fetchApplicationStats: vi.fn(),
}));

vi.mock("./api", () => ({
  fetchApplications: api.fetchApplications,
  fetchApplicationStats: api.fetchApplicationStats,
}));

interface ApplicationsStoreConfig {
  defaultStatus: ApplicationStatus | null;
  defaultSortBy?: ApplicationSortBy;
}

function newState(overrides: Partial<ApplicationsStoreConfig> = {}) {
  return createApplicationsStore({ defaultStatus: null, ...overrides });
}

const listResult = {
  applications: [{ id: "a1" }],
  next_cursor: "nxt",
  prev_cursor: "prv",
  has_more: true,
};

const statsResponse = {
  data: { total: 3, accepted: 1, rejected: 1, pending: 1 },
};

describe("applicant-list store", () => {
  it("starts empty with loading false and default status", () => {
    const store = newState().getState();
    expect(store.applications).toEqual([]);
    expect(store.loading).toBe(false);
    expect(store.currentStatus).toBeNull();
    expect(store.hasMore).toBe(false);
    expect(store.stats).toBeNull();
  });

  it("flips loading on and applies fetched applications, cursors, and filters", async () => {
    api.fetchApplications.mockResolvedValue({ status: 200, data: listResult });

    const store = newState();
    const p = store.getState().fetchApplications();
    expect(store.getState().loading).toBe(true);

    await p;
    const s = store.getState();
    expect(s.loading).toBe(false);
    expect(s.applications).toEqual([{ id: "a1" }]);
    expect(s.nextCursor).toBe("nxt");
    expect(s.prevCursor).toBe("prv");
    expect(s.hasMore).toBe(true);
  });

  it("derives status/search from current state when not overridden", async () => {
    api.fetchApplications.mockResolvedValue({ status: 200, data: listResult });
    const store = newState();
    store.getState().setStatusFilter("accepted");
    await store.getState().fetchApplications();
    expect(api.fetchApplications).toHaveBeenCalledWith(
      expect.objectContaining({ status: "accepted", sort_by: undefined }),
      undefined,
    );
  });

  it("overrides status/search/sort via params", async () => {
    api.fetchApplications.mockResolvedValue({ status: 200, data: listResult });
    const store = newState({ defaultSortBy: "created_at" });
    await store.getState().fetchApplications({
      status: "rejected",
      search: "ada",
      sort_by: "accept_votes",
    });
    expect(api.fetchApplications).toHaveBeenCalledWith(
      expect.objectContaining({
        status: "rejected",
        search: "ada",
        sort_by: "accept_votes",
      }),
      undefined,
    );
  });

  it("clears the list on a failed fetch", async () => {
    api.fetchApplications.mockResolvedValue({ status: 500 });
    const store = newState();
    store.getState().setStatusFilter("accepted");
    await store.getState().fetchApplications();
    const s = store.getState();
    expect(s.applications).toEqual([]);
    expect(s.hasMore).toBe(false);
    expect(s.loading).toBe(false);
  });

  it("ignores aborted fetch responses without applying data", async () => {
    api.fetchApplications.mockResolvedValue({ status: 200, data: listResult });
    const store = newState();
    const controller = new AbortController();
    controller.abort();
    await store.getState().fetchApplications({}, controller.signal);
    expect(store.getState().applications).toEqual([]);
  });

  it("loads application statistics into state", async () => {
    api.fetchApplicationStats.mockResolvedValue({
      status: 200,
      ...statsResponse,
    });
    const store = newState();
    await store.getState().fetchStats();
    expect(store.getState().stats).toEqual(statsResponse.data);
    expect(store.getState().statsLoading).toBe(false);
  });

  it("resets pagination to defaults via resetPagination", async () => {
    api.fetchApplications.mockResolvedValue({ status: 200, data: listResult });
    const store = newState({ defaultStatus: "draft" });
    store.getState().setStatusFilter("accepted");
    await store.getState().fetchApplications({ search: "ada" });
    store.getState().resetPagination();
    const s = store.getState();
    expect(s.applications).toEqual([]);
    expect(s.nextCursor).toBeNull();
    expect(s.hasMore).toBe(false);
    expect(s.currentStatus).toBe("draft");
    expect(s.currentSearch).toBe("");
  });
});
