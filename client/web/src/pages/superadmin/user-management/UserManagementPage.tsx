import { useEffect, useRef, useState } from "react";

import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
} from "@/components/ui/card";
import { SearchField } from "@/components/ui/search-field";
import { PaginationControls } from "@/pages/admin/all-applicants/components/PaginationControls";

import { RoleChangeDialog } from "./components/RoleChangeDialog";
import { UserTable } from "./components/UserTable";
import { useUserManagementStore } from "./store";
import type { PendingRoleChange } from "./types";
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
    fetchUsers,
    setSearchInput,
    toggleRole,
    handleToggle,
    updateUserRole,
  } = useUserManagementStore();
  const [pendingRoleChange, setPendingRoleChange] =
    useState<PendingRoleChange | null>(null);
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

  const search =
    searchInput.length >= MIN_SEARCH_LENGTH ? searchInput : undefined;

  return (
    <div className="flex flex-col gap-3 h-full min-h-0">
      <div className="shrink-0 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="w-full sm:w-[18rem]">
          <SearchField
            placeholder="Search by name or email..."
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
          />
        </div>
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

      <Card className="flex-1 flex flex-col min-h-0 overflow-hidden">
        <CardHeader className="shrink-0">
          <div className="flex items-center justify-between">
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
          </div>
        </CardHeader>
        <hr className="border-border -mb-2" />
        <CardContent className="p-0 flex-1 overflow-hidden">
          <UserTable
            users={users}
            loading={loading}
            togglingId={togglingId}
            updatingRoleId={updatingRoleId}
            onToggle={handleToggle}
            onRoleChange={setPendingRoleChange}
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
    </div>
  );
}
