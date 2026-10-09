import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { useUserStore } from "@/shared/stores";
import type { User } from "@/types";

import { AppearanceRow } from "./AppearanceRow";

function user(overrides: Partial<User> = {}): User {
  return {
    id: "user-1",
    email: "hacker@test.com",
    role: "hacker",
    theme: "dark",
    createdAt: "2026-10-01T15:00:00Z",
    updatedAt: "2026-10-01T15:00:00Z",
    ...overrides,
  };
}

const updateTheme = vi.fn();

function renderRow(theme: User["theme"]) {
  useUserStore.setState(
    {
      ...useUserStore.getInitialState(),
      user: user({ theme }),
      updateTheme,
    },
    true,
  );
  return render(<AppearanceRow />);
}

beforeEach(() => {
  localStorage.clear();
});

describe("AppearanceRow", () => {
  it.each([
    { theme: "dark", checked: "true" },
    { theme: "light", checked: "false" },
  ] as const)("shows $theme as dark mode $checked", ({ theme, checked }) => {
    renderRow(theme);
    expect(screen.getByRole("switch", { name: "Dark mode" })).toHaveAttribute(
      "aria-checked",
      checked,
    );
  });

  it.each([
    { from: "dark", to: "light" },
    { from: "light", to: "dark" },
  ] as const)("switches from $from to $to", async ({ from, to }) => {
    const userEv = userEvent.setup();
    renderRow(from);

    await userEv.click(screen.getByRole("switch", { name: "Dark mode" }));

    expect(updateTheme).toHaveBeenCalledWith(to);
  });
});
