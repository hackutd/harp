import { Loader2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import type { UserRole } from "@/types";

import type { AdminUser, PendingRoleChange } from "../types";
import {
  allRoles,
  formatDate,
  formatUserName,
  getUserInitial,
  roleActiveStyles,
  roleLabels,
} from "../utils";

interface UserTableProps {
  users: AdminUser[];
  loading: boolean;
  togglingId: string | null;
  updatingRoleId: string | null;
  onToggle: (userId: string, currentStatus: boolean) => void;
  onRoleChange: (change: PendingRoleChange) => void;
}

export function UserTable({
  users,
  loading,
  togglingId,
  updatingRoleId,
  onToggle,
  onRoleChange,
}: UserTableProps) {
  const [editingRoleId, setEditingRoleId] = useState<string | null>(null);
  const editingRoleCellRef = useRef<HTMLTableCellElement | null>(null);

  useEffect(() => {
    if (!editingRoleId) return;
    function handleClickOutside(e: MouseEvent) {
      if (
        editingRoleCellRef.current &&
        !editingRoleCellRef.current.contains(e.target as Node)
      ) {
        setEditingRoleId(null);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [editingRoleId]);

  return (
    <div className="relative overflow-auto h-full p-6 pt-0">
      <Table className="border-collapse [&_th]:border-r [&_th]:border-gray-200 [&_td]:border-r [&_td]:border-gray-200 [&_th:last-child]:border-r-0 [&_td:last-child]:border-r-0">
        <TableHeader className="sticky top-0 bg-card z-10">
          <TableRow>
            <TableHead className="w-10"></TableHead>
            <TableHead className="max-w-36">Name</TableHead>
            <TableHead className="max-w-36">Email</TableHead>
            <TableHead className="min-w-56">
              <Tooltip>
                <TooltipTrigger asChild>
                  <span className="cursor-default">Role</span>
                </TooltipTrigger>
                <TooltipContent>
                  Click on a role badge to change it
                </TooltipContent>
              </Tooltip>
            </TableHead>
            <TableHead>
              <Tooltip>
                <TooltipTrigger asChild>
                  <span className="cursor-default">Review Assignment</span>
                </TooltipTrigger>
                <TooltipContent>
                  Only super admins can bypass review assignments
                </TooltipContent>
              </Tooltip>
            </TableHead>
            <TableHead>Created</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {loading ? (
            [...Array(6)].map((_, i) => (
              <TableRow key={i} className="[&>td]:py-3">
                <TableCell className="w-10">
                  <Skeleton className="size-7 rounded-full" />
                </TableCell>
                <TableCell>
                  <Skeleton className="h-4 w-24" />
                </TableCell>
                <TableCell>
                  <Skeleton className="h-4 w-32" />
                </TableCell>
                <TableCell>
                  <Skeleton className="h-5 w-16 rounded-sm" />
                </TableCell>
                <TableCell>
                  <Skeleton className="h-5 w-20" />
                </TableCell>
                <TableCell>
                  <Skeleton className="h-4 w-20" />
                </TableCell>
              </TableRow>
            ))
          ) : users.length === 0 ? (
            <TableRow>
              <TableCell
                colSpan={6}
                className="text-center text-muted-foreground h-24"
              >
                No users found
              </TableCell>
            </TableRow>
          ) : (
            users.map((user) => {
              const name = formatUserName(user.first_name, user.last_name);
              return (
                <TableRow key={user.id} className="[&>td]:py-3">
                  <TableCell className="w-10">
                    <Avatar className="size-7">
                      {user.profile_picture_url ? (
                        <AvatarImage
                          src={user.profile_picture_url}
                          alt={user.first_name ?? user.email}
                        />
                      ) : null}
                      <AvatarFallback className="text-xs bg-muted">
                        {getUserInitial(user.first_name, user.email)}
                      </AvatarFallback>
                    </Avatar>
                  </TableCell>
                  <TableCell className="max-w-36 truncate">
                    {name || (
                      <span className="text-muted-foreground">&mdash;</span>
                    )}
                  </TableCell>
                  <TableCell className="max-w-36 truncate">
                    {user.email}
                  </TableCell>
                  <TableCell
                    ref={
                      editingRoleId === user.id ? editingRoleCellRef : undefined
                    }
                    className={
                      editingRoleId !== user.id ? "cursor-pointer" : ""
                    }
                    onClick={() => {
                      if (editingRoleId !== user.id) {
                        setEditingRoleId(user.id);
                      }
                    }}
                  >
                    {editingRoleId === user.id ? (
                      <div className="flex items-center gap-1">
                        {allRoles.map((role: UserRole) => {
                          const isSelected = role === user.role;
                          return (
                            <button
                              key={role}
                              disabled={updatingRoleId === user.id}
                              className={`inline-flex items-center text-xs px-1.5 py-0.5 rounded-full cursor-pointer transition-opacity ${roleActiveStyles[role]} ${
                                isSelected
                                  ? "opacity-100 ring-1 ring-current"
                                  : "opacity-40 hover:opacity-70"
                              }`}
                              onClick={(e) => {
                                e.stopPropagation();
                                if (isSelected) {
                                  setEditingRoleId(null);
                                } else {
                                  onRoleChange({
                                    userId: user.id,
                                    email: user.email,
                                    newRole: role,
                                  });
                                }
                              }}
                            >
                              {roleLabels[role]}
                            </button>
                          );
                        })}
                        {updatingRoleId === user.id && (
                          <Loader2 className="size-3 animate-spin text-muted-foreground" />
                        )}
                      </div>
                    ) : (
                      <Badge
                        variant="outline"
                        className={`text-xs ${roleActiveStyles[user.role]}`}
                      >
                        {roleLabels[user.role]}
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell>
                    {user.role === "super_admin" ? (
                      <div className="flex items-center gap-2">
                        <Switch
                          checked={user.review_assignment_enabled ?? true}
                          onCheckedChange={() =>
                            onToggle(
                              user.id,
                              user.review_assignment_enabled ?? true,
                            )
                          }
                          disabled={togglingId !== null}
                          aria-label={`Toggle review assignment for ${user.email}`}
                          className="cursor-pointer"
                        />
                        <span className="text-sm text-muted-foreground">
                          {(user.review_assignment_enabled ?? true)
                            ? "Enabled"
                            : "Disabled"}
                        </span>
                        {togglingId === user.id && (
                          <Loader2 className="size-3 animate-spin text-muted-foreground" />
                        )}
                      </div>
                    ) : (
                      <span className="text-sm text-muted-foreground">
                        &mdash;
                      </span>
                    )}
                  </TableCell>
                  <TableCell>{formatDate(user.created_at)}</TableCell>
                </TableRow>
              );
            })
          )}
        </TableBody>
      </Table>
    </div>
  );
}
