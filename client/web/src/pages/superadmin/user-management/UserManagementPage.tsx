import { Loader2, UserCog } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { errorAlert, getRequest, postRequest } from "@/shared/lib/api";

interface AdminUser {
  id: string;
  email: string;
  review_assignment_enabled: boolean;
}

export default function UserManagementPage() {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [togglingId, setTogglingId] = useState<string | null>(null);

  useEffect(() => {
    async function fetchUsers() {
      const res = await getRequest<{
        admins: { id: string; email: string; enabled: boolean }[];
      }>("/superadmin/settings/review-assignment-toggle", "super admins");
      if (res.status === 200 && res.data) {
        setUsers(
          (res.data.admins ?? []).map((a) => ({
            id: a.id,
            email: a.email,
            review_assignment_enabled: a.enabled,
          })),
        );
      } else {
        errorAlert(res);
      }
      setLoading(false);
    }
    fetchUsers();
  }, []);

  async function handleToggle(userId: string, currentStatus: boolean) {
    setTogglingId(userId);
    const res = await postRequest<{ user_id: string; enabled: boolean }>(
      `/superadmin/settings/review-assignment-toggle`,
      { user_id: userId, enabled: !currentStatus },
      "review assignment status",
    );

    if (res.status === 200 && res.data) {
      const enabled = res.data.enabled;
      setUsers((prev) =>
        prev.map((u) =>
          u.id === userId ? { ...u, review_assignment_enabled: enabled } : u,
        ),
      );
      toast.success(
        `Review assignment ${enabled ? "enabled" : "disabled"} for user`,
      );
    } else {
      errorAlert(res);
    }
    setTogglingId(null);
  }

  return (
    <div className="flex flex-col gap-4 h-full min-h-0">
      <Card className="flex-1 flex flex-col min-h-0 overflow-hidden">
        <CardHeader className="shrink-0">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>User Management</CardTitle>
              <CardDescription>
                Manage admin access and review assignment settings
              </CardDescription>
            </div>
            <UserCog className="size-5 text-muted-foreground" />
          </div>
        </CardHeader>
        <CardContent className="p-0 flex-1 overflow-auto">
          {loading ? (
            <div className="flex items-center justify-center h-full">
              <Loader2 className="size-6 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <Table>
              <TableHeader className="sticky top-0 bg-card z-10">
                <TableRow>
                  <TableHead>Email</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Review Assignment</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {users.map((user) => (
                  <TableRow key={user.id}>
                    <TableCell className="font-medium">{user.email}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className="capitalize">
                        Super Admin
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Switch
                          checked={user.review_assignment_enabled}
                          onCheckedChange={() =>
                            handleToggle(
                              user.id,
                              user.review_assignment_enabled,
                            )
                          }
                          disabled={togglingId !== null}
                          aria-label={`Toggle review assignment for ${user.email}`}
                          className="cursor-pointer"
                        />
                        <span className="text-sm text-muted-foreground">
                          {user.review_assignment_enabled
                            ? "Enabled"
                            : "Disabled"}
                        </span>
                        {togglingId === user.id && (
                          <Loader2 className="size-3 animate-spin text-muted-foreground" />
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
                {users.length === 0 && (
                  <TableRow>
                    <TableCell
                      colSpan={3}
                      className="text-center text-muted-foreground h-24"
                    >
                      No users found
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
