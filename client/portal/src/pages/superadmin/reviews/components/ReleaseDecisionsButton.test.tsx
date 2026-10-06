import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { ApplicationStats } from "@/pages/admin/all-applicants/types";

import { useDecisionReleaseStore } from "../releaseStore";
import { ReleaseDecisionsButton } from "./ReleaseDecisionsButton";

const api = vi.hoisted(() => ({
  fetchDecisionsReleased: vi.fn(),
  setDecisionsReleased: vi.fn(),
}));
vi.mock("../api", () => ({
  fetchDecisionsReleased: api.fetchDecisionsReleased,
  setDecisionsReleased: api.setDecisionsReleased,
}));

const toast = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn() }));
vi.mock("sonner", () => ({ toast }));

function stats(overrides: Partial<ApplicationStats> = {}): ApplicationStats {
  return {
    total_applications: 20,
    submitted: 4,
    accepted: 10,
    rejected: 3,
    waitlisted: 2,
    draft: 1,
    acceptance_rate: 0.5,
    rsvp_pending: 4,
    rsvp_confirmed: 5,
    rsvp_declined: 1,
    checked_in: 0,
    no_shows: 5,
    ...overrides,
  };
}

beforeEach(() => {
  useDecisionReleaseStore.setState(
    useDecisionReleaseStore.getInitialState(),
    true,
  );
});

describe("ReleaseDecisionsButton", () => {
  it("releases decisions after confirmation", async () => {
    const user = userEvent.setup();
    api.fetchDecisionsReleased.mockResolvedValue({
      status: 200,
      data: { released: false },
    });
    api.setDecisionsReleased.mockResolvedValue({
      status: 200,
      data: { released: true },
    });
    render(<ReleaseDecisionsButton stats={stats()} />);

    await user.click(
      await screen.findByRole("button", { name: "Release Decisions" }),
    );
    expect(
      screen.getByText(
        "10 accepted, 2 waitlisted, 3 rejected; 4 still under review.",
      ),
    ).toBeInTheDocument();
    await user.click(
      screen.getByRole("button", { name: "Yes, Release Decisions" }),
    );

    expect(api.setDecisionsReleased).toHaveBeenCalledWith(true);
    expect(
      await screen.findByRole("button", { name: "Hide Decisions" }),
    ).toBeInTheDocument();
    expect(screen.getByText("Decisions released")).toBeInTheDocument();
  });

  it("does not release when the confirmation is cancelled", async () => {
    const user = userEvent.setup();
    api.fetchDecisionsReleased.mockResolvedValue({
      status: 200,
      data: { released: false },
    });
    render(<ReleaseDecisionsButton stats={null} />);

    await user.click(
      await screen.findByRole("button", { name: "Release Decisions" }),
    );
    await user.click(screen.getByRole("button", { name: "Cancel" }));

    expect(api.setDecisionsReleased).not.toHaveBeenCalled();
    expect(
      screen.getByRole("button", { name: "Release Decisions" }),
    ).toBeInTheDocument();
  });

  it("hides released decisions after confirmation", async () => {
    const user = userEvent.setup();
    api.fetchDecisionsReleased.mockResolvedValue({
      status: 200,
      data: { released: true },
    });
    api.setDecisionsReleased.mockResolvedValue({
      status: 200,
      data: { released: false },
    });
    render(<ReleaseDecisionsButton stats={stats()} />);

    await user.click(
      await screen.findByRole("button", { name: "Hide Decisions" }),
    );
    await user.click(
      screen.getByRole("button", { name: "Yes, Hide Decisions" }),
    );

    expect(api.setDecisionsReleased).toHaveBeenCalledWith(false);
    expect(
      await screen.findByRole("button", { name: "Release Decisions" }),
    ).toBeInTheDocument();
    expect(screen.queryByText("Decisions released")).not.toBeInTheDocument();
  });

  it("offers a retry when the release state cannot be loaded", async () => {
    const user = userEvent.setup();
    api.fetchDecisionsReleased.mockResolvedValueOnce({
      status: 500,
      error: "boom",
    });
    render(<ReleaseDecisionsButton stats={null} />);

    api.fetchDecisionsReleased.mockResolvedValueOnce({
      status: 200,
      data: { released: false },
    });
    await user.click(
      await screen.findByRole("button", { name: "Retry release status" }),
    );

    expect(
      await screen.findByRole("button", { name: "Release Decisions" }),
    ).toBeInTheDocument();
    expect(api.setDecisionsReleased).not.toHaveBeenCalled();
  });
});
