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
  return new Date(iso).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

const SENT_PAGE_SIZE = 20;

const tableClasses =
  "border-collapse [&_th]:border-r [&_th]:border-gray-200 [&_td]:border-r [&_td]:border-gray-200 [&_th:last-child]:border-r-0 [&_td:last-child]:border-r-0";

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

  const visibleSent = sent.slice(0, sentLimit);

  return (
    <Card className="flex h-full min-h-0 flex-col overflow-hidden">
      <Tabs
        value={tab}
        onValueChange={(v) => setTab(v as "scheduled" | "sent")}
        className="flex min-h-0 flex-1 flex-col gap-3"
      >
        <CardHeader className="shrink-0">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-3">
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
              <div className="h-5 w-px shrink-0 bg-border" />
              <CardDescription className="flex flex-wrap items-center gap-1.5 font-light">
                {tab === "scheduled" ? (
                  <span>
                    Push notifications delivered at their scheduled time
                  </span>
                ) : (
                  <>
                    <span>
                      Showing {visibleSent.length} of {sent.length} sent
                    </span>
                    <Badge className="bg-green-100 text-xs font-light text-green-800">
                      {sent.reduce((acc, n) => acc + n.recipient_count, 0)}{" "}
                      recipients
                    </Badge>
                  </>
                )}
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setGenerateOpen(true)}
                disabled={saving}
                className="cursor-pointer font-light"
              >
                <CalendarClock className="mr-1 size-4" />
                From schedule
              </Button>
              <Button
                size="sm"
                onClick={openCreate}
                disabled={saving}
                className="cursor-pointer"
              >
                <Plus className="mr-1 size-4" />
                Create
              </Button>
            </div>
          </div>
        </CardHeader>
        <hr className="border-border" />
        <CardContent className="min-h-0 flex-1 overflow-hidden p-0">
          <TabsContent value="scheduled" className="h-full">
            <div className="relative h-full overflow-auto p-6 pt-0 pb-3">
              <Table className={tableClasses}>
                <TableHeader className="sticky top-0 z-10 bg-card">
                  <TableRow>
                    <TableHead>Title</TableHead>
                    <TableHead>Target</TableHead>
                    <TableHead>Scheduled</TableHead>
                    <TableHead className="w-32 text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {scheduled.length === 0 ? (
                    <TableRow>
                      <TableCell
                        colSpan={4}
                        className="h-24 text-center text-muted-foreground"
                      >
                        No scheduled notifications
                      </TableCell>
                    </TableRow>
                  ) : (
                    scheduled.map((n) => (
                      <TableRow
                        key={n.id}
                        className="hover:bg-muted/50 [&>td]:py-3"
                      >
                        <TableCell className="max-w-xs">
                          <div>{n.title}</div>
                          <div className="truncate text-xs text-muted-foreground">
                            {n.body}
                          </div>
                        </TableCell>
                        <TableCell>{formatTarget(n.target_role)}</TableCell>
                        <TableCell className="tabular-nums text-muted-foreground">
                          {formatDateTime(n.scheduled_at)}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-1">
                            <Button
                              variant="ghost"
                              size="icon-sm"
                              disabled={saving}
                              onClick={() => openEdit(n)}
                              className="cursor-pointer text-muted-foreground"
                              aria-label="Edit"
                            >
                              <Pencil className="size-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon-sm"
                              disabled={saving}
                              onClick={() => setDeleteTarget(n)}
                              className="cursor-pointer text-muted-foreground hover:text-red-500"
                              aria-label="Delete"
                            >
                              <Trash2 className="size-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </TabsContent>

          <TabsContent value="sent" className="h-full">
            <div className="relative h-full overflow-auto p-6 pt-0 pb-3">
              <Table className={tableClasses}>
                <TableHeader className="sticky top-0 z-10 bg-card">
                  <TableRow>
                    <TableHead>Title</TableHead>
                    <TableHead>Target</TableHead>
                    <TableHead>Sent</TableHead>
                    <TableHead className="w-32 text-right">
                      Recipients
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sent.length === 0 ? (
                    <TableRow>
                      <TableCell
                        colSpan={4}
                        className="h-24 text-center text-muted-foreground"
                      >
                        No notifications sent yet
                      </TableCell>
                    </TableRow>
                  ) : (
                    visibleSent.map((n) => (
                      <TableRow
                        key={n.id}
                        className="hover:bg-muted/50 [&>td]:py-3"
                      >
                        <TableCell className="max-w-xs">
                          <div>{n.title}</div>
                          <div className="truncate text-xs text-muted-foreground">
                            {n.body}
                          </div>
                        </TableCell>
                        <TableCell>{formatTarget(n.target_role)}</TableCell>
                        <TableCell className="tabular-nums text-muted-foreground">
                          {formatDateTime(n.sent_at ?? n.scheduled_at)}
                        </TableCell>
                        <TableCell className="text-right">
                          <Badge className="bg-green-100 font-light text-green-800">
                            {n.recipient_count}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
              {sent.length > sentLimit && (
                <div className="flex justify-center py-3">
                  <Button
                    variant="outline"
                    size="sm"
                    className="cursor-pointer font-light"
                    onClick={() =>
                      setSentLimit((prev) => prev + SENT_PAGE_SIZE)
                    }
                  >
                    Show more ({sent.length - sentLimit} remaining)
                  </Button>
                </div>
              )}
            </div>
          </TabsContent>
        </CardContent>
      </Tabs>

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
              className="cursor-pointer bg-destructive text-white hover:bg-destructive/90"
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
