import { Loader2, Search } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { errorAlert, getRequest, patchRequest } from "@/shared/lib/api";

interface UserListItem {
  id: string;
  email: string;
  role: "hacker" | "admin" | "super_admin";
  first_name: string | null;
  last_name: string | null;
  profile_picture_url: string | null;
  created_at: string;
}

type UserRole = "hacker" | "admin" | "super_admin";

const roleLabels: Record<UserRole, string> = {
  hacker: "Hacker",
  admin: "Admin",
  super_admin: "Super Admin",
};

const roleBadgeStyles: Record<UserRole, string> = {
  hacker: "bg-zinc-700 text-zinc-300 hover:bg-zinc-700",
  admin: "bg-blue-900/50 text-blue-300 hover:bg-blue-900/50",
  super_admin: "bg-purple-900/50 text-purple-300 hover:bg-purple-900/50",
};

function getInitials(user: UserListItem): string {
  if (user.first_name && user.last_name) {
    return (user.first_name[0] + user.last_name[0]).toUpperCase();
  }
  return user.email.slice(0, 2).toUpperCase();
}

export function SetAdminTab() {
  const [searchQuery, setSearchQuery] = useState("");
  const [users, setUsers] = useState<UserListItem[]>([]);
  const [searching, setSearching] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [updatingUserId, setUpdatingUserId] = useState<string | null>(null);

  const [confirmOpen, setConfirmOpen] = useState(false);
  const [pendingChange, setPendingChange] = useState<{
    user: UserListItem;
    newRole: UserRole;
  } | null>(null);

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const searchUsers = useCallback(async (query: string) => {
    if (query.length < 2) {
      setUsers([]);
      setHasSearched(false);
      return;
    }

    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setSearching(true);
    const res = await getRequest<{
      users: UserListItem[];
      total_count: number;
    }>(
      `/superadmin/users?search=${encodeURIComponent(query)}&limit=20`,
      "search users",
      controller.signal,
    );

    if (controller.signal.aborted) return;

    if (res.status === 200 && res.data) {
      setUsers(res.data.users ?? []);
    } else {
      errorAlert(res);
    }
    setSearching(false);
    setHasSearched(true);
  }, []);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);

    debounceRef.current = setTimeout(() => {
      searchUsers(searchQuery);
    }, 300);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [searchQuery, searchUsers]);

  useEffect(() => {
    return () => {
      abortRef.current?.abort();
    };
  }, []);

  function handleRoleSelect(user: UserListItem, newRole: UserRole) {
    if (newRole === user.role) return;
    setPendingChange({ user, newRole });
    setConfirmOpen(true);
  }

  async function handleConfirmRoleChange() {
    if (!pendingChange) return;
    setConfirmOpen(false);

    const { user, newRole } = pendingChange;
    setUpdatingUserId(user.id);

    const res = await patchRequest<{ data: { user: { role: UserRole } } }>(
      `/superadmin/users/${user.id}/role`,
      { role: newRole },
      "update user role",
    );

    if (res.status === 200 && res.data?.data?.user) {
      const updatedRole = res.data.data.user.role;
      setUsers((prev) =>
        prev.map((u) => (u.id === user.id ? { ...u, role: updatedRole } : u)),
      );
      toast.success(`Updated ${user.email} to ${roleLabels[updatedRole]}`);
    } else {
      errorAlert(res);
    }

    setUpdatingUserId(null);
    setPendingChange(null);
  }

  return (
    <div className="space-y-6">
      <Card className="bg-zinc-900 border-zinc-800 border-0 rounded-md">
        <CardHeader>
          <CardTitle className="font-normal text-zinc-100">Set Admin</CardTitle>
          <CardDescription className="text-zinc-400">
            Search for users by email or name and update their role.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-zinc-500" />
            <Input
              placeholder="Search by email or name (min 2 characters)..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 bg-zinc-800 border-zinc-700 text-zinc-100 placeholder:text-zinc-500 focus-visible:ring-zinc-600"
            />
          </div>
        </CardContent>
      </Card>

      {searching && (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="size-6 animate-spin text-zinc-400" />
        </div>
      )}

      {!searching && hasSearched && users.length === 0 && (
        <p className="text-center text-sm text-zinc-500 py-8">
          No users found.
        </p>
      )}

      {!searching && users.length > 0 && (
        <div className="space-y-2">
          {users.map((user) => (
            <Card
              key={user.id}
              className="bg-zinc-900 border-zinc-800 border-0 rounded-md"
            >
              <CardContent className="flex items-center justify-between px-4">
                <div className="flex items-center gap-3 min-w-0">
                  <Avatar className="size-8 shrink-0">
                    <AvatarImage
                      src={user.profile_picture_url || undefined}
                      alt={user.email}
                    />
                    <AvatarFallback className="bg-zinc-700 text-zinc-300 text-xs">
                      {getInitials(user)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-zinc-100 truncate">
                        {user.email}
                      </span>
                      <Badge
                        className={`text-xs shrink-0 ${roleBadgeStyles[user.role]}`}
                      >
                        {roleLabels[user.role]}
                      </Badge>
                    </div>
                    {(user.first_name || user.last_name) && (
                      <p className="text-xs text-zinc-500 truncate">
                        {[user.first_name, user.last_name]
                          .filter(Boolean)
                          .join(" ")}
                      </p>
                    )}
                  </div>
                </div>

                <Select
                  value={user.role}
                  onValueChange={(value: UserRole) =>
                    handleRoleSelect(user, value)
                  }
                  disabled={updatingUserId === user.id}
                >
                  <SelectTrigger className="w-[140px] bg-zinc-800 border-zinc-700 text-zinc-300 cursor-pointer">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-zinc-800 border-zinc-700">
                    <SelectItem
                      value="hacker"
                      className="text-zinc-300 cursor-pointer focus:bg-zinc-700 focus:text-zinc-100"
                    >
                      Hacker
                    </SelectItem>
                    <SelectItem
                      value="admin"
                      className="text-zinc-300 cursor-pointer focus:bg-zinc-700 focus:text-zinc-100"
                    >
                      Admin
                    </SelectItem>
                    <SelectItem
                      value="super_admin"
                      className="text-zinc-300 cursor-pointer focus:bg-zinc-700 focus:text-zinc-100"
                    >
                      Super Admin
                    </SelectItem>
                  </SelectContent>
                </Select>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent className="bg-zinc-900 border-zinc-800">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-zinc-100">
              Confirm Role Change
            </AlertDialogTitle>
            <AlertDialogDescription className="text-zinc-400">
              {pendingChange && (
                <>
                  Change{" "}
                  <span className="text-zinc-200">
                    {pendingChange.user.email}
                  </span>{" "}
                  from{" "}
                  <span className="text-zinc-200">
                    {roleLabels[pendingChange.user.role]}
                  </span>{" "}
                  to{" "}
                  <span className="text-zinc-200">
                    {roleLabels[pendingChange.newRole]}
                  </span>
                  ?
                </>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="bg-zinc-900 cursor-pointer border-0 text-zinc-400 border-zinc-700 hover:bg-zinc-700 hover:text-zinc-300">
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmRoleChange}
              className="bg-zinc-100 text-zinc-900 hover:bg-zinc-200 cursor-pointer"
            >
              Yes, Change Role
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
