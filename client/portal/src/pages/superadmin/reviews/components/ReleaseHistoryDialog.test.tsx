import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { useDecisionReleaseStore } from "../releaseStore";
import type { DecisionRelease } from "../types";
import { ReleaseHistoryDialog } from "./ReleaseHistoryDialog";

const api = vi.hoisted(() => ({
  fetchDecisionReleases: vi.fn(),
  createDecisionRelease: vi.fn(),
  undoDecisionRelease: vi.fn(),
}));
vi.mock("../api", () => api);
vi.mock("@/shared/lib/api", () => ({ errorAlert: vi.fn() }));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), warning: vi.fn() } }));

function release(overrides: Partial<DecisionRelease>): DecisionRelease {
  return {
    id: "rel",
    released_by: "admin-1",
    released_by_email: "admin@example.com",
    audience: "priority",
    statuses: ["accepted", "waitlisted", "rejected"],
    priority_deadline: "2026-10-03T23:59:59.999-05:00",
    released_count: 10,
    created_at: "2026-10-10T15:00:00Z",
    undone_at: null,
    undone_by_email: null,
    emailed_count: 0,
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  useDecisionReleaseStore.setState(
    useDecisionReleaseStore.getInitialState(),
    true,
  );
});

describe("ReleaseHistoryDialog", () => {
  it("offers undo only on the newest release still in effect", async () => {
    api.fetchDecisionReleases.mockResolvedValue({
      status: 200,
      data: {
        releases: [
          release({ id: "rel-3", undone_at: "2026-10-11T15:00:00Z" }),
          release({ id: "rel-2", released_count: 4 }),
          release({ id: "rel-1", released_count: 1310 }),
        ],
      },
    });
    render(<ReleaseHistoryDialog open onOpenChange={vi.fn()} />);

    expect(await screen.findByText("1,310 decisions")).toBeInTheDocument();
    expect(screen.getByText("Undone")).toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: "Undo" })).toHaveLength(1);
  });

  it("warns that sent emails stay sent, then undoes", async () => {
    const user = userEvent.setup();
    api.fetchDecisionReleases.mockResolvedValue({
      status: 200,
      data: {
        releases: [release({ id: "rel-1", emailed_count: 7 })],
      },
    });
    api.undoDecisionRelease.mockResolvedValue({
      status: 200,
      data: {
        releases: [release({ id: "rel-1", undone_at: "2026-10-11T15:00:00Z" })],
      },
    });
    render(<ReleaseHistoryDialog open onOpenChange={vi.fn()} />);

    await user.click(await screen.findByRole("button", { name: "Undo" }));
    expect(
      screen.getByText(/7 applicants have already been emailed/),
    ).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Yes, undo release" }));

    expect(api.undoDecisionRelease).toHaveBeenCalledWith("rel-1");
    expect(await screen.findByText("Undone")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Undo" })).toBeNull();
  });

  it("says when nothing has been released", async () => {
    api.fetchDecisionReleases.mockResolvedValue({
      status: 200,
      data: { releases: [] },
    });
    render(<ReleaseHistoryDialog open onOpenChange={vi.fn()} />);

    expect(
      await screen.findByText(/No decisions have been released yet/),
    ).toBeInTheDocument();
  });
});
