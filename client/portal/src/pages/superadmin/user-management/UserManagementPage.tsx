import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
} from "@/components/ui/card";
import { SearchBar } from "@/pages/admin/_shared";
import { PaginationControls } from "@/pages/admin/all-applicants/components/PaginationControls";
import { useUserStore } from "@/shared/stores";

import { DeleteUserDialog } from "./components/DeleteUserDialog";
import { RoleChangeDialog } from "./components/RoleChangeDialog";
import { UserTable } from "./components/UserTable";
import { useUserManagementStore } from "./store";
import type { PendingRoleChange, PendingUserDeletion } from "./types";
import {
  allRoles,
  MIN_SEARCH_LENGTH,
  roleActiveStyles,
  roleInactiveStyles,
  roleLabels,
} from "./utils";

export default function UserManagementPage() {
  const {
    users,
    loading,
    searchInput,
    activeRoles,
    nextCursor,
    prevCursor,
    togglingId,
    updatingRoleId,
    deletingId,
    fetchUsers,
    setSearchInput,
    toggleRole,
    handleToggle,
    updateUserRole,
    deleteUser,
  } = useUserManagementStore();
  const currentUserId = useUserStore((s) => s.user?.id ?? null);
  const [pendingRoleChange, setPendingRoleChange] =
    useState<PendingRoleChange | null>(null);
  const [pendingDeletion, setPendingDeletion] =
    useState<PendingUserDeletion | null>(null);
  const isFirstRender = useRef(true);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }

    const timeout = setTimeout(() => {
      if (searchInput.length >= MIN_SEARCH_LENGTH) {
        fetchUsers({ search: searchInput });
      } else if (searchInput.length === 0) {
        fetchUsers();
      }
    }, 500);

    return () => clearTimeout(timeout);
  }, [searchInput, fetchUsers]);

  async function handleConfirmRoleChange() {
    if (!pendingRoleChange) return;
    const { userId, newRole } = pendingRoleChange;
    setPendingRoleChange(null);
    await updateUserRole(userId, newRole);
  }

  async function handleConfirmDeletion() {
    if (!pendingDeletion) return;
    const { userId, email, name } = pendingDeletion;
    const success = await deleteUser(userId);
    setPendingDeletion(null);
    if (success) {
      toast.success(`Deleted ${name || email}`);
    }
  }

  const search =
    searchInput.length >= MIN_SEARCH_LENGTH ? searchInput : undefined;

  return (
    <div className="flex flex-col gap-3 h-full min-h-0">
      <Card className="flex-1 flex flex-col min-h-0 overflow-hidden">
        <CardHeader className="shrink-0">
          <div className="flex items-center justify-between gap-2">
            <CardDescription className="font-light flex items-center gap-1.5">
              <span>{users.length} user(s) on this page</span>
              {searchInput.length >= MIN_SEARCH_LENGTH && (
                <span>matching &quot;{searchInput}&quot;</span>
              )}
              <span>
                {activeRoles.length === 0 ? "showing all" : "filtered by"}
              </span>
              {allRoles.map((role) => {
                const isActive = activeRoles.includes(role);
                return (
                  <Badge
                    key={role}
                    variant="outline"
                    className={`text-xs cursor-pointer select-none ${isActive ? roleActiveStyles[role] : roleInactiveStyles}`}
                    onClick={() => toggleRole(role)}
                  >
                    {roleLabels[role]}
                  </Badge>
                );
              })}
            </CardDescription>
            <div className="flex items-center gap-2">
              <SearchBar value={searchInput} onChange={setSearchInput} />
              <PaginationControls
                prevCursor={prevCursor}
                nextCursor={nextCursor}
                loading={loading}
                onPrevPage={() =>
                  fetchUsers({
                    search,
                    cursor: prevCursor!,
                    direction: "backward",
                  })
                }
                onNextPage={() =>
                  fetchUsers({
                    search,
                    cursor: nextCursor!,
                    direction: "forward",
                  })
                }
              />
            </div>
          </div>
        </CardHeader>
        <hr className="border-border -mb-2" />
        <CardContent className="p-0 flex-1 overflow-hidden">
          <UserTable
            users={users}
            loading={loading}
            togglingId={togglingId}
            updatingRoleId={updatingRoleId}
            deletingId={deletingId}
            currentUserId={currentUserId}
            onToggle={handleToggle}
            onRoleChange={setPendingRoleChange}
            onDelete={setPendingDeletion}
          />
        </CardContent>
      </Card>

      <RoleChangeDialog
        pendingChange={pendingRoleChange}
        currentRole={
          users.find((u) => u.id === pendingRoleChange?.userId)?.role ??
          "hacker"
        }
        onConfirm={handleConfirmRoleChange}
        onCancel={() => setPendingRoleChange(null)}
      />

      <DeleteUserDialog
        pendingDeletion={pendingDeletion}
        deleting={deletingId !== null}
        onConfirm={handleConfirmDeletion}
        onCancel={() => setPendingDeletion(null)}
      />
    </div>
  );
}
