import { useEffect } from "react";

import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

import { NotificationsTable } from "./components/NotificationsTable";
import { useNotificationsStore } from "./store";

export default function NotificationsPage() {
  const {
    notifications,
    loading,
    saving,
    fetch: fetchNotifications,
    create,
    update,
    remove,
  } = useNotificationsStore();

  useEffect(() => {
    const controller = new AbortController();
    fetchNotifications(controller.signal);
    return () => controller.abort();
  }, [fetchNotifications]);

  if (loading && notifications.length === 0) {
    return (
      <div className="space-y-6 overflow-auto">
        <Card>
          <CardHeader>
            <Skeleton className="h-5 w-40" />
          </CardHeader>
          <CardContent className="space-y-3">
            {[...Array(3)].map((_, i) => (
              <Skeleton key={i} className="h-14 w-full" />
            ))}
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden">
      <NotificationsTable
        notifications={notifications}
        saving={saving}
        onCreate={create}
        onUpdate={update}
        onDelete={remove}
      />
    </div>
  );
}
