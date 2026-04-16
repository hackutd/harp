import { toast } from "sonner";
import { create } from "zustand";

import { errorAlert } from "@/shared/lib/api";
import type { UserRole } from "@/types";

import {
  fetchUsers as apiFetchUsers,
  toggleReviewAssignment,
  updateUserRole as apiUpdateUserRole,
} from "./api";
import type { AdminUser, FetchUsersParams } from "./types";
import { allRoles, MIN_SEARCH_LENGTH, roleLabels } from "./utils";

interface UserManagementState {
  users: AdminUser[];
  loading: boolean;
  nextCursor: string | null;
  prevCursor: string | null;
  activeRoles: UserRole[];
  searchInput: string;
  togglingId: string | null;
  updatingRoleId: string | null;

  fetchUsers: (params?: FetchUsersParams) => Promise<void>;
  setSearchInput: (value: string) => void;
  toggleRole: (role: UserRole) => void;
  handleToggle: (userId: string, currentStatus: boolean) => Promise<void>;
  updateUserRole: (userId: string, newRole: UserRole) => Promise<boolean>;
}

export const useUserManagementStore = create<UserManagementState>(
  (set, get) => ({
    users: [],
    loading: true,
    nextCursor: null,
    prevCursor: null,
    activeRoles: [],
    searchInput: "",
    togglingId: null,
    updatingRoleId: null,

    fetchUsers: async (params?: FetchUsersParams) => {
      const state = get();
      const activeRoles = params?.roles ?? state.activeRoles;
      // No filter selected = fetch all roles
      const roles = activeRoles.length === 0 ? [...allRoles] : activeRoles;

      set({ loading: true });
      try {
        const res = await apiFetchUsers({ ...params, roles });
        if (res.status === 200 && res.data) {
          set({
            users: res.data.users ?? [],
            nextCursor: res.data.next_cursor ?? null,
            prevCursor: res.data.prev_cursor ?? null,
            loading: false,
          });
        } else {
          errorAlert(res);
          set({ loading: false });
        }
      } catch {
        set({ loading: false });
      }
    },

    setSearchInput: (value: string) => {
      set({ searchInput: value });
    },

    toggleRole: (role: UserRole) => {
      const state = get();
      const newRoles = state.activeRoles.includes(role)
        ? state.activeRoles.filter((r) => r !== role)
        : [...state.activeRoles, role];
      set({ activeRoles: newRoles });

      const search =
        state.searchInput.length >= MIN_SEARCH_LENGTH
          ? state.searchInput
          : undefined;
      get().fetchUsers({ roles: newRoles, search });
    },

    handleToggle: async (userId: string, currentStatus: boolean) => {
      set({ togglingId: userId });
      try {
        const res = await toggleReviewAssignment(userId, !currentStatus);

        if (res.status === 200 && res.data) {
          const enabled = res.data.enabled;
          set((state) => ({
            users: state.users.map((u) =>
              u.id === userId
                ? { ...u, review_assignment_enabled: enabled }
                : u,
            ),
            togglingId: null,
          }));
          toast.success(
            `Review assignment ${enabled ? "enabled" : "disabled"} for user`,
          );
        } else {
          errorAlert(res);
          set({ togglingId: null });
        }
      } catch {
        set({ togglingId: null });
      }
    },

    updateUserRole: async (userId: string, newRole: UserRole) => {
      set({ updatingRoleId: userId });
      try {
        const res = await apiUpdateUserRole(userId, newRole);
        if (res.status === 200) {
          set((state) => ({
            users: state.users.map((u) =>
              u.id === userId ? { ...u, role: newRole } : u,
            ),
            updatingRoleId: null,
          }));
          toast.success(`Updated role to ${roleLabels[newRole]}`);
          return true;
        } else {
          errorAlert(res);
          set({ updatingRoleId: null });
          return false;
        }
      } catch {
        set({ updatingRoleId: null });
        return false;
      }
    },
  }),
);
