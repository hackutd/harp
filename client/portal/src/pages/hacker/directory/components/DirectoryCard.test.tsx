import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { directoryCard } from "../testFixtures";
import { DirectoryCard } from "./DirectoryCard";

const toast = vi.hoisted(() =>
  Object.assign(vi.fn(), { success: vi.fn(), error: vi.fn() }),
);
vi.mock("sonner", () => ({ toast }));

describe("DirectoryCard", () => {
  it("shows the checked-in badge and intent", () => {
    render(
      <DirectoryCard
        card={directoryCard({
          checked_in: true,
          intent: "partial_team",
          spots_needed: 2,
        })}
      />,
    );
    expect(screen.getByLabelText("Checked in")).toBeInTheDocument();
    expect(screen.getByText("Team needs 2 more")).toBeInTheDocument();
  });

  it("keeps the details off the small card until it's opened", async () => {
    render(
      <DirectoryCard
        card={directoryCard({
          icebreaker_prompt: "Ask me about",
          icebreaker_answer: "robots",
          experiences: [{ company: "Acme", title: "SWE Intern" }],
        })}
      />,
    );
    expect(screen.getByText("\u201crobots\u201d")).toBeInTheDocument();
    expect(screen.queryByRole("listitem")).not.toBeInTheDocument();

    await userEvent.click(
      screen.getByRole("button", { name: "More about Bob Builder" }),
    );

    expect(screen.getByRole("listitem")).toHaveTextContent(
      "SWE Intern at Acme",
    );
    expect(screen.getByText("Ask me about")).toBeInTheDocument();
  });

  it("shows experience and links to GitHub and LinkedIn", () => {
    render(
      <DirectoryCard
        detailed
        card={directoryCard({
          github_username: "octocat",
          linkedin_handle: "jane-doe",
          experiences: [{ company: "Acme", title: "SWE Intern" }],
        })}
      />,
    );
    expect(screen.getByRole("listitem")).toHaveTextContent(
      "SWE Intern at Acme",
    );
    expect(screen.getByRole("link", { name: "octocat" })).toHaveAttribute(
      "href",
      "https://github.com/octocat",
    );
    expect(screen.getByRole("link", { name: "LinkedIn" })).toHaveAttribute(
      "href",
      "https://www.linkedin.com/in/jane-doe",
    );
  });

  it("offers poke back when they poked you", async () => {
    const onPoke = vi.fn();
    const card = directoryCard({ poked_me: true });
    render(<DirectoryCard card={card} onPoke={onPoke} />);

    await userEvent.click(screen.getByRole("button", { name: "Poke back" }));

    expect(onPoke).toHaveBeenCalledWith(card);
    expect(screen.getByText("Poked you")).toBeInTheDocument();
  });

  it("disables poke once sent", () => {
    render(<DirectoryCard card={directoryCard({ poked_by_me: true })} />);
    expect(screen.getByRole("button", { name: "Poke sent" })).toBeDisabled();
  });

  it("wires contact and hide buttons", async () => {
    const onToggleContact = vi.fn();
    const onHide = vi.fn();
    render(
      <DirectoryCard
        card={directoryCard()}
        onToggleContact={onToggleContact}
        onHide={onHide}
      />,
    );

    await userEvent.click(
      screen.getByRole("button", { name: "Add to contacts" }),
    );
    await userEvent.click(screen.getByRole("button", { name: "Hide" }));

    expect(onToggleContact).toHaveBeenCalledOnce();
    expect(onHide).toHaveBeenCalledOnce();
  });

  it("only shows Discord after a match", () => {
    const { rerender } = render(
      <DirectoryCard card={directoryCard({ discord_username: "bob" })} />,
    );
    expect(
      screen.queryByRole("button", { name: "Copy Discord: bob" }),
    ).not.toBeInTheDocument();

    rerender(
      <DirectoryCard
        card={directoryCard({ matched: true, discord_username: "bob" })}
      />,
    );
    expect(
      screen.getByRole("button", { name: "Copy Discord: bob" }),
    ).toBeInTheDocument();
  });

  it("copies the username when there's no Discord ID", async () => {
    const user = userEvent.setup();
    const writeText = vi
      .spyOn(navigator.clipboard, "writeText")
      .mockResolvedValue();
    render(
      <DirectoryCard
        card={directoryCard({ matched: true, discord_username: "bob_rsvp" })}
      />,
    );

    await user.click(
      screen.getByRole("button", { name: "Copy Discord: bob_rsvp" }),
    );

    expect(writeText).toHaveBeenCalledWith("bob_rsvp");
    expect(toast.success).toHaveBeenCalled();
  });

  it("shows unhide for hidden cards", async () => {
    const onUnhide = vi.fn();
    render(
      <DirectoryCard
        card={directoryCard({ is_hidden: true })}
        onUnhide={onUnhide}
      />,
    );
    expect(
      screen.queryByRole("button", { name: "Poke" }),
    ).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Unhide" }));
    expect(onUnhide).toHaveBeenCalledOnce();
  });
});
