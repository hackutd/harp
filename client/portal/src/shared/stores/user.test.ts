import { beforeEach, describe, expect, it, vi } from "vitest";

import { readCachedTheme, writeCachedTheme } from "@/shared/lib/theme";
import type { User } from "@/types";

import { useUserStore } from "./user";

const api = vi.hoisted(() => ({
  getRequest: vi.fn(),
  patchRequest: vi.fn(),
  errorAlert: vi.fn(),
}));
vi.mock("@/shared/lib/api", () => api);

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

beforeEach(() => {
  localStorage.clear();
  useUserStore.setState(useUserStore.getInitialState(), true);
});

describe("fetchUser", () => {
  it("caches the user's theme for the next page load", async () => {
    api.getRequest.mockResolvedValue({
      status: 200,
      data: user({ theme: "light" }),
    });

    await useUserStore.getState().fetchUser();

    expect(useUserStore.getState().user?.theme).toBe("light");
    expect(readCachedTheme()).toBe("light");
  });
});

describe("updateTheme", () => {
  it("applies the theme immediately and saves it", async () => {
    useUserStore.setState({ user: user() });
    let resolve: (value: unknown) => void = () => {};
    api.patchRequest.mockReturnValue(new Promise((r) => (resolve = r)));

    const pending = useUserStore.getState().updateTheme("light");

    expect(useUserStore.getState().user?.theme).toBe("light");
    expect(readCachedTheme()).toBe("light");
    expect(api.patchRequest).toHaveBeenCalledWith(
      "/users/me/theme",
      { theme: "light" },
      "theme",
    );

    resolve({ status: 200, data: user({ theme: "light", updatedAt: "now" }) });
    await pending;

    expect(useUserStore.getState().user).toMatchObject({
      theme: "light",
      updatedAt: "now",
    });
    expect(api.errorAlert).not.toHaveBeenCalled();
  });

  it("rolls back and alerts when the save fails", async () => {
    useUserStore.setState({ user: user() });
    writeCachedTheme("dark");
    const failure = { status: 500, error: "boom" };
    api.patchRequest.mockResolvedValue(failure);

    await useUserStore.getState().updateTheme("light");

    expect(useUserStore.getState().user?.theme).toBe("dark");
    expect(readCachedTheme()).toBe("dark");
    expect(api.errorAlert).toHaveBeenCalledWith(failure);
  });

  it("ignores a response that a newer choice has overtaken", async () => {
    useUserStore.setState({ user: user() });
    let resolveFirst: (value: unknown) => void = () => {};
    api.patchRequest
      .mockReturnValueOnce(new Promise((r) => (resolveFirst = r)))
      .mockResolvedValueOnce({ status: 200, data: user({ theme: "dark" }) });

    const first = useUserStore.getState().updateTheme("light");
    await useUserStore.getState().updateTheme("dark");
    resolveFirst({ status: 500, error: "boom" });
    await first;

    expect(useUserStore.getState().user?.theme).toBe("dark");
    expect(api.errorAlert).not.toHaveBeenCalled();
  });

  it("does nothing when signed out or already on that theme", async () => {
    await useUserStore.getState().updateTheme("light");
    useUserStore.setState({ user: user({ theme: "light" }) });
    await useUserStore.getState().updateTheme("light");

    expect(api.patchRequest).not.toHaveBeenCalled();
  });
});
