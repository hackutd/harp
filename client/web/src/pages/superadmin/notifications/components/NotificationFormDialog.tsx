import { Loader2 } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import type { UserRole } from "@/types";

import type {
  ScheduledNotification,
  ScheduledNotificationPayload,
} from "../types";

const TARGET_ALL = "__all";
type TargetOption = UserRole | typeof TARGET_ALL;

const ROLE_OPTIONS: { value: TargetOption; label: string }[] = [
  { value: TARGET_ALL, label: "All users" },
  { value: "hacker", label: "Hackers" },
  { value: "admin", label: "Admins" },
  { value: "super_admin", label: "Super Admins" },
];

function defaultScheduledLocal(): string {
  const now = new Date(Date.now() + 5 * 60 * 1000);
  now.setSeconds(0, 0);
  return toLocalInputValue(now.toISOString());
}

function toLocalInputValue(iso: string): string {
  const d = new Date(iso);
  const tzOffsetMs = d.getTimezoneOffset() * 60_000;
  const local = new Date(d.getTime() - tzOffsetMs);
  return local.toISOString().slice(0, 16);
}

interface NotificationFormProps {
  notification: ScheduledNotification | null;
  saving: boolean;
  onSubmit: (payload: ScheduledNotificationPayload) => Promise<boolean>;
  onCancel: () => void;
}

function NotificationForm({
  notification,
  saving,
  onSubmit,
  onCancel,
}: NotificationFormProps) {
  const [title, setTitle] = useState(notification?.title ?? "");
  const [body, setBody] = useState(notification?.body ?? "");
  const [url, setUrl] = useState(notification?.url ?? "");
  const [target, setTarget] = useState<TargetOption>(
    notification?.target_role ?? TARGET_ALL,
  );
  const [scheduledAt, setScheduledAt] = useState<string>(
    notification?.scheduled_at
      ? toLocalInputValue(notification.scheduled_at)
      : defaultScheduledLocal(),
  );

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !body.trim() || !scheduledAt) return;

    const isoScheduled = new Date(scheduledAt).toISOString();
    const ok = await onSubmit({
      title: title.trim(),
      body: body.trim(),
      url: url.trim() === "" ? null : url.trim(),
      target_role: target === TARGET_ALL ? null : (target as UserRole),
      scheduled_at: isoScheduled,
    });
    if (ok) {
      onCancel();
    }
  };

  return (
    <form onSubmit={submit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="notif-title">Title</Label>
        <Input
          id="notif-title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          maxLength={100}
          placeholder="Applications close in 1 hour"
          required
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="notif-body">Body</Label>
        <Textarea
          id="notif-body"
          value={body}
          onChange={(e) => setBody(e.target.value)}
          maxLength={300}
          rows={3}
          placeholder="Submit your application before midnight to be considered."
          required
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="notif-url">Click-through URL (optional)</Label>
        <Input
          id="notif-url"
          type="url"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="https://harp.hackutd.co/app"
        />
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="notif-target">Target audience</Label>
          <Select
            value={target}
            onValueChange={(v) => setTarget(v as TargetOption)}
          >
            <SelectTrigger id="notif-target">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {ROLE_OPTIONS.map((opt) => (
                <SelectItem key={opt.value} value={opt.value}>
                  {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="notif-time">Scheduled time</Label>
          <Input
            id="notif-time"
            type="datetime-local"
            value={scheduledAt}
            onChange={(e) => setScheduledAt(e.target.value)}
            required
          />
        </div>
      </div>
      <DialogFooter>
        <Button
          type="button"
          variant="outline"
          onClick={onCancel}
          className="cursor-pointer"
        >
          Cancel
        </Button>
        <Button
          type="submit"
          disabled={saving || !title.trim() || !body.trim()}
          className="cursor-pointer"
        >
          {saving && <Loader2 className="mr-2 size-4 animate-spin" />}
          {notification ? "Save" : "Schedule"}
        </Button>
      </DialogFooter>
    </form>
  );
}

interface NotificationFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  notification: ScheduledNotification | null;
  saving: boolean;
  onSubmit: (payload: ScheduledNotificationPayload) => Promise<boolean>;
}

export function NotificationFormDialog({
  open,
  onOpenChange,
  notification,
  saving,
  onSubmit,
}: NotificationFormDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {notification ? "Edit notification" : "Schedule notification"}
          </DialogTitle>
        </DialogHeader>
        {open && (
          <NotificationForm
            key={notification?.id ?? "new"}
            notification={notification}
            saving={saving}
            onSubmit={onSubmit}
            onCancel={() => onOpenChange(false)}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}
