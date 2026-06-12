import { CalendarClock, Pencil, Plus, Trash2 } from "lucide-react";
import { useMemo, useState } from "react";

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
import { Card, CardContent, CardDescription } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

import type {
  GenerateScheduleNotificationsPayload,
  ScheduledNotification,
  ScheduledNotificationPayload,
} from "../types";
import { GenerateFromScheduleDialog } from "./GenerateFromScheduleDialog";
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
  onGenerateFromSchedule: (
    payload: GenerateScheduleNotificationsPayload,
  ) => Promise<boolean>;
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

const SENT_PAGE_SIZE = 20;

export function NotificationsTable({
  notifications,
  saving,
  onCreate,
  onUpdate,
  onDelete,
  onGenerateFromSchedule,
}: NotificationsTableProps) {
  const [formOpen, setFormOpen] = useState(false);
  const [generateOpen, setGenerateOpen] = useState(false);
  const [editing, setEditing] = useState<ScheduledNotification | null>(null);
  const [deleteTarget, setDeleteTarget] =
    useState<ScheduledNotification | null>(null);
  const [tab, setTab] = useState<"scheduled" | "sent">("scheduled");
  const [sentLimit, setSentLimit] = useState(SENT_PAGE_SIZE);

  const { scheduled, sent } = useMemo(() => {
    const scheduled: ScheduledNotification[] = [];
    const sent: ScheduledNotification[] = [];
    for (const n of notifications) {
      (n.sent_at ? sent : scheduled).push(n);
    }
    scheduled.sort((a, b) => a.scheduled_at.localeCompare(b.scheduled_at));
    sent.sort((a, b) => (b.sent_at ?? "").localeCompare(a.sent_at ?? ""));
    return { scheduled, sent };
  }, [notifications]);

  const openCreate = () => {
    setEditing(null);
    setFormOpen(true);
  };

  const openEdit = (n: ScheduledNotification) => {
    setEditing(n);
    setFormOpen(true);
  };

  return (
    <Card className="flex h-full flex-col overflow-hidden py-3">
      <CardContent className="flex min-h-0 flex-1 flex-col overflow-hidden pt-2">
        <Tabs
          value={tab}
          onValueChange={(v) => setTab(v as "scheduled" | "sent")}
          className="flex min-h-0 flex-1 flex-col"
        >
          <div className="flex flex-row items-center justify-between gap-4">
            <div className="flex flex-row items-center gap-4">
              <TabsList className="h-9 gap-0 rounded-md border p-0.5">
                <TabsTrigger
                  value="scheduled"
                  className="cursor-pointer rounded-sm font-light"
                >
                  Scheduled ({scheduled.length})
                </TabsTrigger>
                <TabsTrigger
                  value="sent"
                  className="cursor-pointer rounded-sm font-light"
                >
                  Sent ({sent.length})
                </TabsTrigger>
              </TabsList>
              <CardDescription>
                Schedule push notifications to be delivered at a specific time.
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="secondary"
                onClick={() => setGenerateOpen(true)}
                disabled={saving}
                className="cursor-pointer"
              >
                <CalendarClock className="mr-1 size-4" />
                From schedule
              </Button>
              <Button
                onClick={openCreate}
                disabled={saving}
                className="cursor-pointer"
              >
                <Plus className="mr-1 size-4" />
                Create
              </Button>
            </div>
          </div>

          <TabsContent value="scheduled" className="min-h-0 overflow-auto">
            {scheduled.length === 0 ? (
              <div className="flex h-32 items-center justify-center text-sm text-muted-foreground">
                No scheduled notifications.
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Title</TableHead>
                    <TableHead>Target</TableHead>
                    <TableHead>Scheduled</TableHead>
                    <TableHead className="w-32 text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {scheduled.map((n) => (
                    <TableRow key={n.id}>
                      <TableCell className="max-w-xs">
                        <div className="font-medium">{n.title}</div>
                        <div className="truncate text-xs text-muted-foreground">
                          {n.body}
                        </div>
                      </TableCell>
                      <TableCell>{formatTarget(n.target_role)}</TableCell>
                      <TableCell>{formatDateTime(n.scheduled_at)}</TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            disabled={saving}
                            onClick={() => openEdit(n)}
                            className="cursor-pointer"
                            aria-label="Edit"
                          >
                            <Pencil className="size-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            disabled={saving}
                            onClick={() => setDeleteTarget(n)}
                            className="cursor-pointer text-destructive hover:text-destructive"
                            aria-label="Delete"
                          >
                            <Trash2 className="size-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </TabsContent>

          <TabsContent value="sent" className="min-h-0 overflow-auto">
            {sent.length === 0 ? (
              <div className="flex h-32 items-center justify-center text-sm text-muted-foreground">
                No notifications sent yet.
              </div>
            ) : (
              <>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Title</TableHead>
                      <TableHead>Target</TableHead>
                      <TableHead>Sent</TableHead>
                      <TableHead className="text-right">Recipients</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {sent.slice(0, sentLimit).map((n) => (
                      <TableRow key={n.id}>
                        <TableCell className="max-w-xs">
                          <div className="font-medium">{n.title}</div>
                          <div className="truncate text-xs text-muted-foreground">
                            {n.body}
                          </div>
                        </TableCell>
                        <TableCell>{formatTarget(n.target_role)}</TableCell>
                        <TableCell>
                          {formatDateTime(n.sent_at ?? n.scheduled_at)}
                        </TableCell>
                        <TableCell className="text-right">
                          <Badge
                            variant="secondary"
                            className="bg-green-100 text-green-800"
                          >
                            {n.recipient_count}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                {sent.length > sentLimit && (
                  <div className="flex justify-center py-3">
                    <Button
                      variant="outline"
                      size="sm"
                      className="cursor-pointer"
                      onClick={() =>
                        setSentLimit((prev) => prev + SENT_PAGE_SIZE)
                      }
                    >
                      Show more ({sent.length - sentLimit} remaining)
                    </Button>
                  </div>
                )}
              </>
            )}
          </TabsContent>
        </Tabs>
      </CardContent>

      <GenerateFromScheduleDialog
        open={generateOpen}
        onOpenChange={setGenerateOpen}
        saving={saving}
        onGenerate={onGenerateFromSchedule}
      />

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
