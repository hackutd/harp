import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { useSettingsDialogStore, useUserStore } from "@/shared/stores";
import type { Application, User } from "@/types";

import { UserSettingsDialog } from "./UserSettingsDialog";

const api = vi.hoisted(() => ({
  getRequest: vi.fn(),
  patchRequest: vi.fn(),
  errorAlert: vi.fn(),
}));
vi.mock("@/shared/lib/api", () => api);

vi.mock("@/shared/push/usePushSubscription", () => ({
  usePushSubscription: () => ({
    supported: true,
    permission: "default",
    enabled: false,
    loading: false,
    enable: vi.fn(),
    disable: vi.fn(),
  }),
}));
vi.mock("@/shared/install", () => ({
  useInstallPrompt: () => ({ installed: true, platform: "desktop" }),
}));

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

function application(overrides: Partial<Application> = {}): Application {
  return {
    id: "app-1",
    status: "submitted",
    resume_path: "resumes/user-1/cv.pdf",
    responses: {},
    ...overrides,
  } as Application;
}

function renderDialog() {
  return render(
    <MemoryRouter>
      <UserSettingsDialog />
    </MemoryRouter>,
  );
}

beforeEach(() => {
  localStorage.clear();
  useUserStore.setState(
    { ...useUserStore.getInitialState(), user: user() },
    true,
  );
  useSettingsDialogStore.setState({ open: false });
  api.getRequest.mockResolvedValue({ status: 200, data: application() });
});

describe("UserSettingsDialog", () => {
  it("stays closed until opened", () => {
    renderDialog();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(api.getRequest).not.toHaveBeenCalled();
  });

  it("shows the settings and account rows when opened", async () => {
    useSettingsDialogStore.setState({ open: true });
    renderDialog();

    expect(
      screen.getByRole("dialog", { name: "Settings" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("switch", { name: "Push notifications" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("switch", { name: "Dark mode" }),
    ).toBeInTheDocument();
    expect(
      await screen.findByRole("button", { name: "View resume" }),
    ).toBeInTheDocument();
    expect(screen.getByText("On file · Locked")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Sign out" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Delete account" }),
    ).toBeInTheDocument();
  });

  it("offers an upload while the application is a draft without a resume", async () => {
    api.getRequest.mockResolvedValue({
      status: 200,
      data: application({ status: "draft", resume_path: undefined }),
    });
    useSettingsDialogStore.setState({ open: true });
    renderDialog();

    expect(
      await screen.findByRole("button", { name: "Upload resume" }),
    ).toBeInTheDocument();
    expect(screen.getByText("Not uploaded")).toBeInTheDocument();
  });
});
