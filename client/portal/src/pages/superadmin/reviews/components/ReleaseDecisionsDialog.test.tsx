import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { useDecisionReleaseStore } from "../releaseStore";
import type { DecisionReleaseCounts } from "../types";
import { ReleaseDecisionsDialog } from "./ReleaseDecisionsDialog";

const api = vi.hoisted(() => ({
  previewDecisionRelease: vi.fn(),
  createDecisionRelease: vi.fn(),
  fetchDecisionReleases: vi.fn(),
  undoDecisionRelease: vi.fn(),
}));
vi.mock("../api", () => api);

const deadline = vi.hoisted(() => ({ value: null as Date | null }));
vi.mock("@/pages/admin/_shared", () => ({
  usePriorityDeadline: () => deadline.value,
}));

vi.mock("@/shared/lib/api", () => ({ errorAlert: vi.fn() }));
const toast = vi.hoisted(() => ({
  success: vi.fn(),
  warning: vi.fn(),
  error: vi.fn(),
}));
vi.mock("sonner", () => ({ toast }));

function counts(
  overrides: Partial<DecisionReleaseCounts> = {},
): DecisionReleaseCounts {
  return {
    new: 0,
    changed: 0,
    travel_only: 0,
    unchanged: 0,
    rsvp_changed: 0,
    ...overrides,
  };
}

function preview(
  audience: string,
  overrides: {
    accepted?: Partial<DecisionReleaseCounts>;
    waitlisted?: Partial<DecisionReleaseCounts>;
    rejected?: Partial<DecisionReleaseCounts>;
    under_review?: number;
  } = {},
) {
  return {
    status: 200,
    data: {
      audience,
      priority_deadline: "2026-10-03T23:59:59.999-05:00",
      preview: {
        by_status: {
          accepted: counts(overrides.accepted ?? { new: 576 }),
          waitlisted: counts(overrides.waitlisted ?? { new: 53 }),
          rejected: counts(overrides.rejected ?? { new: 681 }),
        },
        under_review: overrides.under_review ?? 0,
      },
    },
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  deadline.value = new Date("2026-10-03T23:59:59.999-05:00");
  useDecisionReleaseStore.setState(
    useDecisionReleaseStore.getInitialState(),
    true,
  );
  api.fetchDecisionReleases.mockResolvedValue({
    status: 200,
    data: { releases: [] },
  });
});

describe("ReleaseDecisionsDialog", () => {
  it("releases the priority group with every decision by default", async () => {
    const user = userEvent.setup();
    const onOpenChange = vi.fn();
    api.previewDecisionRelease.mockImplementation((audience: string) =>
      Promise.resolve(preview(audience)),
    );
    api.createDecisionRelease.mockResolvedValue({
      status: 201,
      data: { release: { id: "rel-1", released_count: 1310 } },
    });
    render(<ReleaseDecisionsDialog open onOpenChange={onOpenChange} />);

    expect(
      await screen.findByRole("button", { name: "Release 1,310 decisions" }),
    ).toBeEnabled();
    expect(api.previewDecisionRelease).toHaveBeenLastCalledWith(
      "priority",
      expect.anything(),
    );

    await user.click(
      screen.getByRole("button", { name: "Release 1,310 decisions" }),
    );

    expect(api.createDecisionRelease).toHaveBeenCalledWith({
      audience: "priority",
      statuses: ["accepted", "waitlisted", "rejected"],
      email: "none",
      send_push: false,
    });
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("counts only the ticked decisions", async () => {
    const user = userEvent.setup();
    api.previewDecisionRelease.mockImplementation((audience: string) =>
      Promise.resolve(preview(audience)),
    );
    render(<ReleaseDecisionsDialog open onOpenChange={vi.fn()} />);

    await screen.findByRole("button", { name: "Release 1,310 decisions" });
    await user.click(screen.getByRole("checkbox", { name: "Rejected" }));

    expect(
      screen.getByRole("button", { name: "Release 629 decisions" }),
    ).toBeEnabled();
  });

  it("only offers everyone without a priority deadline", async () => {
    deadline.value = null;
    api.previewDecisionRelease.mockImplementation((audience: string) =>
      Promise.resolve(preview(audience)),
    );
    render(<ReleaseDecisionsDialog open onOpenChange={vi.fn()} />);

    await screen.findByRole("button", { name: "Release 1,310 decisions" });
    expect(api.previewDecisionRelease).toHaveBeenCalledWith(
      "everyone",
      expect.anything(),
    );
    expect(screen.getByRole("radio", { name: /^Priority/ })).toBeDisabled();
    expect(screen.getByRole("radio", { name: /^Regular/ })).toBeDisabled();
    expect(screen.getByText(/Set a priority deadline/)).toBeInTheDocument();
  });

  it("warns about applicants left under review and changed RSVPs", async () => {
    api.previewDecisionRelease.mockImplementation((audience: string) =>
      Promise.resolve(
        preview(audience, {
          accepted: { changed: 3, rsvp_changed: 2 },
          under_review: 1063,
        }),
      ),
    );
    render(<ReleaseDecisionsDialog open onOpenChange={vi.fn()} />);

    expect(
      await screen.findByText(/1,063 applicants in this group are still/),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/2 applicants already RSVP'd to a decision/),
    ).toBeInTheDocument();
  });

  it("warns that an announcement to some statuses reveals the outcome", async () => {
    const user = userEvent.setup();
    api.previewDecisionRelease.mockImplementation((audience: string) =>
      Promise.resolve(preview(audience)),
    );
    render(<ReleaseDecisionsDialog open onOpenChange={vi.fn()} />);

    await screen.findByRole("button", { name: "Release 1,310 decisions" });
    await user.click(
      screen.getByRole("radio", { name: /Send “decisions are out”/ }),
    );
    expect(screen.queryByText(/reveals the/)).not.toBeInTheDocument();

    await user.click(screen.getByRole("checkbox", { name: "Rejected" }));
    expect(screen.getByText(/reveals the/)).toBeInTheDocument();
  });

  it("sends the chosen emails and push with the release", async () => {
    const user = userEvent.setup();
    api.previewDecisionRelease.mockImplementation((audience: string) =>
      Promise.resolve(preview(audience)),
    );
    api.createDecisionRelease.mockResolvedValue({
      status: 201,
      data: {
        release: { id: "rel-1", released_count: 1310 },
        emails: { mode: "decision", queued: 1310, skipped: 0 },
      },
    });
    render(<ReleaseDecisionsDialog open onOpenChange={vi.fn()} />);

    await screen.findByRole("button", { name: "Release 1,310 decisions" });
    const push = screen.getByRole("switch");
    expect(push).toBeDisabled();

    await user.click(
      screen.getByRole("radio", { name: /Send each applicant their result/ }),
    );
    await user.click(push);
    await user.click(
      screen.getByRole("button", { name: "Release 1,310 decisions" }),
    );

    expect(api.createDecisionRelease).toHaveBeenCalledWith(
      expect.objectContaining({ email: "decision", send_push: true }),
    );
    expect(toast.success).toHaveBeenCalledWith(
      "Released 1310 decisions. Emailing 1310 applicants.",
    );
  });

  it("disables release when nothing would change", async () => {
    api.previewDecisionRelease.mockImplementation((audience: string) =>
      Promise.resolve(
        preview(audience, {
          accepted: { unchanged: 5 },
          waitlisted: {},
          rejected: {},
        }),
      ),
    );
    render(<ReleaseDecisionsDialog open onOpenChange={vi.fn()} />);

    const button = await screen.findByRole("button", {
      name: "Release 0 decisions",
    });
    expect(button).toBeDisabled();
    const accepted = screen
      .getByRole("checkbox", { name: "Accepted" })
      .closest("div") as HTMLElement;
    expect(
      within(accepted.parentElement!).getByText("5 already see it"),
    ).toBeInTheDocument();
  });
});
