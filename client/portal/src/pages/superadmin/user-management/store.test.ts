import { beforeEach, describe, expect, it, vi } from "vitest";

import { useUserManagementStore } from "./store";
import type { AdminUser } from "./types";

const api = vi.hoisted(() => ({
  fetchUsers: vi.fn(),
  toggleReviewAssignment: vi.fn(),
  updateUserRole: vi.fn(),
}));
vi.mock("./api", () => ({
  fetchUsers: api.fetchUsers,
  toggleReviewAssignment: api.toggleReviewAssignment,
  updateUserRole: api.updateUserRole,
}));

const errorAlert = vi.hoisted(() => vi.fn());
vi.mock("@/shared/lib/api", () => ({ errorAlert }));

const toast = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn() }));
vi.mock("sonner", () => ({ toast }));

function user(id: string, overrides: Partial<AdminUser> = {}): AdminUser {
  return {
    id,
    email: `${id}@example.com`,
    role: "admin",
    first_name: "Ada",
    last_name: "L",
    created_at: "2026-03-14T15:00:00Z",
    review_assignment_enabled: false,
    ...overrides,
  };
}

const listResult = {
  users: [user("1"), user("2")],
  next_cursor: "n",
  prev_cursor: "p",
  has_more: true,
};

beforeEach(() => {
  useUserManagementStore.setState({
    users: [],
    loading: true,
    nextCursor: null,
    prevCursor: null,
    activeRoles: [],
    searchInput: "",
    togglingId: null,
    updatingRoleId: null,
  });
  vi.clearAllMocks();
});

describe("user-management store: fetchUsers params", () => {
  it("fetches all roles when no filter is selected", async () => {
    api.fetchUsers.mockResolvedValue({ status: 200, data: listResult });
    await useUserManagementStore.getState().fetchUsers();
    expect(api.fetchUsers).toHaveBeenCalledWith(
      expect.objectContaining({
        roles: ["super_admin", "admin", "hacker"],
      }),
    );
    expect(useUserManagementStore.getState().users).toHaveLength(2);
    expect(useUserManagementStore.getState().loading).toBe(false);
  });

  it("passes through explicit role filters and search", async () => {
    api.fetchUsers.mockResolvedValue({ status: 200, data: listResult });
    await useUserManagementStore
      .getState()
      .fetchUsers({ roles: ["admin"], search: "ada" });
    expect(api.fetchUsers).toHaveBeenCalledWith(
      expect.objectContaining({ roles: ["admin"], search: "ada" }),
    );
  });
});

describe("user-management store: role filters and search", () => {
  it("toggles a role filter and re-fetches with the new roles", async () => {
    api.fetchUsers.mockResolvedValue({ status: 200, data: listResult });
    useUserManagementStore.getState().setSearchInput("ada");
    useUserManagementStore.getState().toggleRole("admin");

    expect(useUserManagementStore.getState().activeRoles).toEqual(["admin"]);
    expect(api.fetchUsers).toHaveBeenCalledWith(
      expect.objectContaining({ roles: ["admin"], search: "ada" }),
    );
  });

  it("removes a role from active filters", async () => {
    api.fetchUsers.mockResolvedValue({ status: 200, data: listResult });
    useUserManagementStore.setState({ activeRoles: ["admin", "hacker"] });
    useUserManagementStore.getState().toggleRole("admin");
    expect(useUserManagementStore.getState().activeRoles).toEqual(["hacker"]);
  });
});

describe("user-management store: review-assignment toggle", () => {
  it("updates the user's toggle and toasts success", async () => {
    useUserManagementStore.setState({
      users: [user("1", { review_assignment_enabled: false })],
    });

    api.toggleReviewAssignment.mockResolvedValue({
      status: 200,
      data: { user_id: "1", enabled: true },
    });

    await useUserManagementStore.getState().handleToggle("1", false);

    const s = useUserManagementStore.getState();
    expect(api.toggleReviewAssignment).toHaveBeenCalledWith("1", true);
    expect(s.users[0].review_assignment_enabled).toBe(true);
    expect(s.togglingId).toBeNull();
    expect(toast.success).toHaveBeenCalled();
  });

  it("clears togglingId on failure", async () => {
    api.toggleReviewAssignment.mockResolvedValue({ status: 500 });
    await useUserManagementStore.getState().handleToggle("1", false);
    expect(useUserManagementStore.getState().togglingId).toBeNull();
    expect(errorAlert).toHaveBeenCalled();
  });
});

describe("user-management store: role update", () => {
  it("updates the role and returns true with toast", async () => {
    useUserManagementStore.setState({ users: [user("1")] });
    api.updateUserRole.mockResolvedValue({ status: 200 });

    const ok = await useUserManagementStore
      .getState()
      .updateUserRole("1", "super_admin");

    expect(api.updateUserRole).toHaveBeenCalledWith("1", "super_admin");
    expect(ok).toBe(true);
    expect(useUserManagementStore.getState().users[0].role).toBe("super_admin");
    expect(useUserManagementStore.getState().updatingRoleId).toBeNull();
    expect(toast.success).toHaveBeenCalled();
  });

  it("returns false on failed role update", async () => {
    useUserManagementStore.setState({ users: [user("1")] });
    api.updateUserRole.mockResolvedValue({ status: 500 });

    const ok = await useUserManagementStore
      .getState()
      .updateUserRole("1", "hacker");

    expect(ok).toBe(false);
    expect(useUserManagementStore.getState().users[0].role).toBe("admin");
    expect(useUserManagementStore.getState().updatingRoleId).toBeNull();
  });
});
