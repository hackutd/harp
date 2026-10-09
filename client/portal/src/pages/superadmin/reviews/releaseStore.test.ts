import { beforeEach, describe, expect, it, vi } from "vitest";

import { latestActiveRelease, useDecisionReleaseStore } from "./releaseStore";
import type { CreateDecisionReleasePayload, DecisionRelease } from "./types";

const api = vi.hoisted(() => ({
  fetchDecisionReleases: vi.fn(),
  createDecisionRelease: vi.fn(),
  undoDecisionRelease: vi.fn(),
}));
vi.mock("./api", () => api);

const sharedApi = vi.hoisted(() => ({ errorAlert: vi.fn() }));
vi.mock("@/shared/lib/api", () => ({ errorAlert: sharedApi.errorAlert }));

const toast = vi.hoisted(() => ({ success: vi.fn(), warning: vi.fn() }));
vi.mock("sonner", () => ({ toast }));

function release(id: string, overrides: Partial<DecisionRelease> = {}) {
  return {
    id,
    released_by: null,
    released_by_email: null,
    audience: "everyone",
    statuses: ["accepted"],
    priority_deadline: null,
    released_count: 1,
    created_at: "2026-10-10T15:00:00Z",
    undone_at: null,
    undone_by_email: null,
    emailed_count: 0,
    ...overrides,
  } as DecisionRelease;
}

const payload: CreateDecisionReleasePayload = {
  audience: "priority",
  statuses: ["accepted"],
  email: "none",
  send_push: false,
};

beforeEach(() => {
  vi.clearAllMocks();
  useDecisionReleaseStore.setState(
    useDecisionReleaseStore.getInitialState(),
    true,
  );
  api.fetchDecisionReleases.mockResolvedValue({
    status: 200,
    data: { releases: [] },
  });
});

describe("fetchReleases", () => {
  it("loads the releases", async () => {
    api.fetchDecisionReleases.mockResolvedValue({
      status: 200,
      data: { releases: [release("rel-1")] },
    });

    await useDecisionReleaseStore.getState().fetchReleases();

    const state = useDecisionReleaseStore.getState();
    expect(state.releases).toEqual([release("rel-1")]);
    expect(state.loading).toBe(false);
  });

  it("keeps releases unknown and records the error on failure", async () => {
    api.fetchDecisionReleases.mockResolvedValue({ status: 500, error: "boom" });

    await useDecisionReleaseStore.getState().fetchReleases();

    const state = useDecisionReleaseStore.getState();
    expect(state.releases).toBeNull();
    expect(state.error).toBe("boom");
  });
});

describe("createRelease", () => {
  it("adds the release and reports the queued emails", async () => {
    api.fetchDecisionReleases.mockResolvedValue({
      status: 200,
      data: { releases: [release("rel-1", { released_count: 629 })] },
    });
    api.createDecisionRelease.mockResolvedValue({
      status: 201,
      data: {
        release: release("rel-1", { released_count: 629 }),
        emails: { mode: "decision", queued: 629, skipped: 0 },
      },
    });

    const result = await useDecisionReleaseStore
      .getState()
      .createRelease(payload);

    expect(result?.release.id).toBe("rel-1");
    expect(useDecisionReleaseStore.getState().releases?.[0].id).toBe("rel-1");
    expect(toast.success).toHaveBeenCalledWith(
      "Released 629 decisions. Emailing 629 applicants.",
    );
  });

  it("warns when the release went out but its emails did not", async () => {
    api.createDecisionRelease.mockResolvedValue({
      status: 201,
      data: {
        release: release("rel-1"),
        email_error: "Decisions were released, but the emails did not start.",
      },
    });

    await useDecisionReleaseStore.getState().createRelease(payload);

    expect(toast.warning).toHaveBeenCalledWith(
      "Decisions were released, but the emails did not start.",
    );
    expect(toast.success).not.toHaveBeenCalled();
  });

  it("reports a refused release and returns null", async () => {
    const res = { status: 409, error: "no unreleased decisions match" };
    api.createDecisionRelease.mockResolvedValue(res);

    const result = await useDecisionReleaseStore
      .getState()
      .createRelease(payload);

    expect(result).toBeNull();
    expect(sharedApi.errorAlert).toHaveBeenCalledWith(res);
    expect(useDecisionReleaseStore.getState().saving).toBe(false);
  });
});

describe("undoRelease", () => {
  it("replaces the list with the server's", async () => {
    const undone = release("rel-1", { undone_at: "2026-10-11T00:00:00Z" });
    api.undoDecisionRelease.mockResolvedValue({
      status: 200,
      data: { releases: [undone] },
    });

    expect(await useDecisionReleaseStore.getState().undoRelease("rel-1")).toBe(
      true,
    );
    expect(useDecisionReleaseStore.getState().releases).toEqual([undone]);
  });

  it("reloads after a failure, since the undo may have committed", async () => {
    api.undoDecisionRelease.mockResolvedValue({ status: 500, error: "boom" });

    expect(await useDecisionReleaseStore.getState().undoRelease("rel-1")).toBe(
      false,
    );
    expect(sharedApi.errorAlert).toHaveBeenCalled();
    expect(api.fetchDecisionReleases).toHaveBeenCalled();
  });
});

describe("latestActiveRelease", () => {
  it("skips undone releases", () => {
    const releases = [
      release("rel-3", { undone_at: "2026-10-11T00:00:00Z" }),
      release("rel-2"),
      release("rel-1"),
    ];
    expect(latestActiveRelease(releases)?.id).toBe("rel-2");
    expect(latestActiveRelease(null)).toBeUndefined();
  });
});
