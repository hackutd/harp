import { Pencil, Plus, Trash2 } from "lucide-react";
import { useState } from "react";

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
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

import type {
  ScheduledNotification,
  ScheduledNotificationPayload,
} from "../types";
import { NotificationFormDialog } from "./NotificationFormDialog";

interface NotificationsTableProps {
  notifications: ScheduledNotification[];
  saving: boolean;
  onCreate: (payload: ScheduledNotificationPayload) => Promise<boolean>;
  onUpdate: (
    id: string,
    payload: ScheduledNotificationPayload,
  ) => Promise<boolean>;
  onDelete: (id: string) => Promise<boolean>;
}

function formatTarget(role: string | null): string {
  if (!role) return "All users";
  if (role === "super_admin") return "Super Admins";
  return role.charAt(0).toUpperCase() + role.slice(1) + "s";
}

function formatDateTime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleString();
}

export function NotificationsTable({
  notifications,
  saving,
  onCreate,
  onUpdate,
  onDelete,
}: NotificationsTableProps) {
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<ScheduledNotification | null>(null);
  const [deleteTarget, setDeleteTarget] =
    useState<ScheduledNotification | null>(null);

  const openCreate = () => {
    setEditing(null);
    setFormOpen(true);
  };

  const openEdit = (n: ScheduledNotification) => {
    setEditing(n);
    setFormOpen(true);
  };

  return (
    <Card className="flex h-full flex-col overflow-hidden">
      <CardHeader className="flex flex-row items-start justify-between gap-4">
        <div>
          <CardDescription>
            Schedule push notifications to be delivered at a specific time.
          </CardDescription>
        </div>
        <Button
          onClick={openCreate}
          disabled={saving}
          className="cursor-pointer"
        >
          <Plus className="mr-1 size-4" />
          Schedule
        </Button>
      </CardHeader>
      <CardContent className="flex-1 overflow-auto">
        {notifications.length === 0 ? (
          <div className="flex h-32 items-center justify-center text-sm text-muted-foreground">
            No scheduled notifications yet.
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Title</TableHead>
                <TableHead>Target</TableHead>
                <TableHead>Scheduled</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-32 text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {notifications.map((n) => {
                const sent = !!n.sent_at;
                return (
                  <TableRow key={n.id}>
                    <TableCell className="max-w-xs">
                      <div className="font-medium">{n.title}</div>
                      <div className="truncate text-xs text-muted-foreground">
                        {n.body}
                      </div>
                    </TableCell>
                    <TableCell>{formatTarget(n.target_role)}</TableCell>
                    <TableCell>{formatDateTime(n.scheduled_at)}</TableCell>
                    <TableCell>
                      {sent ? (
                        <Badge
                          variant="secondary"
                          className="bg-green-100 text-green-800"
                        >
                          Sent · {n.recipient_count}
                        </Badge>
                      ) : (
                        <Badge variant="outline">Pending</Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          disabled={saving || sent}
                          onClick={() => openEdit(n)}
                          className="cursor-pointer"
                          aria-label="Edit"
                        >
                          <Pencil className="size-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          disabled={saving || sent}
                          onClick={() => setDeleteTarget(n)}
                          className="cursor-pointer text-destructive hover:text-destructive"
                          aria-label="Delete"
                        >
                          <Trash2 className="size-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </CardContent>

      <NotificationFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        notification={editing}
        saving={saving}
        onSubmit={async (payload) => {
          if (editing) {
            return onUpdate(editing.id, payload);
          }
          return onCreate(payload);
        }}
      />

      <AlertDialog
        open={deleteTarget !== null}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete notification?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently remove &ldquo;{deleteTarget?.title}&rdquo;.
              Already-sent notifications cannot be deleted.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="cursor-pointer">
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              className="cursor-pointer bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={saving}
              onClick={async () => {
                if (deleteTarget && !saving) {
                  await onDelete(deleteTarget.id);
                }
                setDeleteTarget(null);
              }}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}
