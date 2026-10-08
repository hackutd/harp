import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { useDirectoryStore } from "../store";
import { directoryCard } from "../testFixtures";
import { MatchDialog } from "./MatchDialog";

vi.mock("../api", () => ({}));
vi.mock("canvas-confetti", () => ({ default: vi.fn() }));

const match = directoryCard({
  display_name: "Ada Lovelace",
  matched: true,
  discord_username: "ada",
  github_username: "adal",
});

describe("MatchDialog", () => {
  beforeEach(() => {
    useDirectoryStore.setState(useDirectoryStore.getInitialState(), true);
    vi.stubGlobal(
      "matchMedia",
      vi.fn().mockReturnValue({ matches: true } as MediaQueryList),
    );
  });

  it("stays closed without a new match", () => {
    render(<MatchDialog />);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("congratulates and shows the unlocked contact details", () => {
    useDirectoryStore.setState({ newMatch: match });
    render(<MatchDialog />);

    expect(
      screen.getByRole("heading", {
        name: "Congrats! You and Ada are connected",
      }),
    ).toBeInTheDocument();
    expect(screen.getByText("ada")).toBeVisible();
    expect(
      screen.queryByRole("link", { name: /discord/i }),
    ).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "GitHub: adal" })).toBeVisible();
  });

  it("copies their Discord username", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal("navigator", { clipboard: { writeText } });
    useDirectoryStore.setState({ newMatch: match });
    render(<MatchDialog />);

    await userEvent.click(
      screen.getByRole("button", { name: "Copy Discord username" }),
    );

    expect(writeText).toHaveBeenCalledWith("ada");
  });

  it("explains when there's nothing to share yet", () => {
    useDirectoryStore.setState({
      newMatch: directoryCard({ matched: true }),
    });
    render(<MatchDialog />);

    expect(screen.getByText(/haven't added discord/i)).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Copy Discord username" }),
    ).not.toBeInTheDocument();
  });

  it("clears the match when dismissed", async () => {
    useDirectoryStore.setState({ newMatch: match });
    render(<MatchDialog />);

    await userEvent.click(screen.getByRole("button", { name: "Done" }));

    expect(useDirectoryStore.getState().newMatch).toBeNull();
  });
});
