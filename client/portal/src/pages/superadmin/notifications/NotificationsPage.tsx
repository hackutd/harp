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
    generateFromSchedule,
  } = useNotificationsStore();

  useEffect(() => {
    const controller = new AbortController();
    fetchNotifications({ signal: controller.signal });
    return () => controller.abort();
  }, [fetchNotifications]);

  useEffect(() => {
    const refreshSilently = () => {
      if (document.visibilityState === "visible") {
        void fetchNotifications({ silent: true });
      }
    };

    const interval = window.setInterval(refreshSilently, 30_000);
    window.addEventListener("focus", refreshSilently);
    document.addEventListener("visibilitychange", refreshSilently);

    return () => {
      window.clearInterval(interval);
      window.removeEventListener("focus", refreshSilently);
      document.removeEventListener("visibilitychange", refreshSilently);
    };
  }, [fetchNotifications]);

  if (loading && notifications.length === 0) {
    return (
      <div className="flex flex-col gap-3 h-full min-h-0">
        <Card className="flex h-full min-h-0 flex-col gap-3 overflow-hidden">
          <CardHeader className="shrink-0">
            <div className="flex items-center justify-between gap-2">
              <Skeleton className="h-9 w-56" />
              <div className="flex items-center gap-2">
                <Skeleton className="h-8 w-32" />
                <Skeleton className="h-8 w-20" />
              </div>
            </div>
          </CardHeader>
          <hr className="border-border" />
          <CardContent className="min-h-0 flex-1 space-y-3 overflow-hidden p-6 pt-0">
            {[...Array(5)].map((_, i) => (
              <Skeleton key={i} className="h-12 w-full" />
            ))}
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3 h-full min-h-0">
      <NotificationsTable
        notifications={notifications}
        saving={saving}
        onCreate={create}
        onUpdate={update}
        onDelete={remove}
        onGenerateFromSchedule={generateFromSchedule}
      />
    </div>
  );
}
