import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { PokesView } from "./PokesView";
import { useDirectoryStore } from "./store";
import { directoryCard } from "./testFixtures";

vi.mock("./api", () => ({}));

const waiting = directoryCard({
  user_id: "w",
  display_name: "Ada Lovelace",
  poked_me: true,
});
const matched = directoryCard({
  user_id: "m",
  display_name: "Grace Hopper",
  poked_me: true,
  poked_by_me: true,
  matched: true,
  discord_username: "grace",
});
const sent = directoryCard({
  user_id: "s",
  display_name: "Alan Turing",
  poked_by_me: true,
});

describe("PokesView", () => {
  const poke = vi.fn();

  beforeEach(() => {
    useDirectoryStore.setState(useDirectoryStore.getInitialState(), true);
    useDirectoryStore.setState({
      fetchPokes: vi.fn().mockResolvedValue(undefined),
      markPokesSeen: vi.fn().mockResolvedValue(undefined),
      poke,
    });
  });

  function renderView() {
    return render(
      <MemoryRouter>
        <PokesView />
      </MemoryRouter>,
    );
  }

  it("shows each person under the section for where they stand", () => {
    useDirectoryStore.setState({
      pokes: [waiting, matched],
      sentPokes: [matched, sent],
    });
    renderView();

    const section = (name: RegExp) =>
      within(screen.getByRole("region", { name }));
    expect(section(/waiting on you/i).getByText("Ada Lovelace")).toBeVisible();
    expect(section(/matched/i).getByText("Grace Hopper")).toBeVisible();
    expect(section(/you poked/i).getByText("Alan Turing")).toBeVisible();
    // A match is listed once, not again under "You poked".
    expect(screen.getAllByText("Grace Hopper")).toHaveLength(1);
  });

  it("pokes back from the waiting section", async () => {
    useDirectoryStore.setState({ pokes: [waiting] });
    renderView();

    await userEvent.click(screen.getByRole("button", { name: "Poke back" }));

    expect(poke).toHaveBeenCalledWith(waiting);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("opens the card from a click anywhere on the row", async () => {
    useDirectoryStore.setState({ pokes: [waiting] });
    renderView();

    await userEvent.click(screen.getByText(/poked you/i));

    expect(
      within(screen.getByRole("dialog")).getByTestId("directory-card"),
    ).toBeInTheDocument();
  });

  it("hides sections with nobody in them", () => {
    useDirectoryStore.setState({ sentPokes: [sent] });
    renderView();

    expect(
      screen.queryByRole("region", { name: /waiting on you/i }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("region", { name: /matched/i }),
    ).not.toBeInTheDocument();
    expect(screen.getByRole("region", { name: /you poked/i })).toBeVisible();
  });

  it("points to the directory when there are no pokes", () => {
    renderView();
    expect(screen.getByText(/no pokes yet/i)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "the Directory" })).toHaveAttribute(
      "href",
      "/app/directory",
    );
  });
});
