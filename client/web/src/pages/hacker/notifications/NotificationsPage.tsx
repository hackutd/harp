import {
  format,
  formatDistanceToNow,
  isToday,
  isYesterday,
  parseISO,
} from "date-fns";
import { useEffect, useMemo, useState } from "react";

import { Skeleton } from "@/components/ui/skeleton";
import type { NotificationFeedItem } from "@/types";

import { getNotificationFeed } from "./api";

function groupLabel(date: Date): string {
  if (isToday(date)) return "Today";
  if (isYesterday(date)) return "Yesterday";
  return format(date, "MMMM d");
}

function itemDate(item: NotificationFeedItem): Date {
  return parseISO(item.sent_at ?? item.scheduled_at);
}

export default function NotificationsPage() {
  const [items, setItems] = useState<NotificationFeedItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const controller = new AbortController();
    const load = async () => {
      const res = await getNotificationFeed(controller.signal);
      if (controller.signal.aborted) return;
      if (res.status === 200 && res.data) {
        setItems(res.data.notifications ?? []);
      }
      setLoading(false);
    };
    load();
    return () => controller.abort();
  }, []);

  const groups = useMemo(() => {
    const map = new Map<string, NotificationFeedItem[]>();
    for (const item of items) {
      const label = groupLabel(itemDate(item));
      const list = map.get(label) ?? [];
      list.push(item);
      map.set(label, list);
    }
    return [...map.entries()];
  }, [items]);

  return (
    <div className="mx-auto max-w-2xl px-5 pt-4 pb-8 md:max-w-5xl md:px-8 md:pt-6">
      <h1 className="text-2xl font-light tracking-tight text-black">
        Notifications
      </h1>

      {loading ? (
        <div className="mt-6 space-y-3">
          <Skeleton className="h-16 w-full rounded-lg" />
          <Skeleton className="h-16 w-full rounded-lg" />
          <Skeleton className="h-16 w-full rounded-lg" />
        </div>
      ) : items.length === 0 ? (
        <p className="pt-12 text-center text-sm font-light text-[#8A8A8A]">
          No notifications yet.
        </p>
      ) : (
        <div className="mt-4 space-y-6">
          {groups.map(([label, groupItems]) => (
            <section key={label}>
              <h2 className="mb-2 text-xs font-light tracking-widest text-[#8A8A8A] uppercase">
                {label}
              </h2>
              <div className="space-y-3">
                {groupItems.map((item) => {
                  const content = (
                    <div className="flex items-start gap-3 rounded-lg border border-[#E5E5E5] bg-white px-4 py-3.5">
                      <span className="mt-1.5 size-2 shrink-0 rounded-full bg-black" />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-baseline justify-between gap-3">
                          <p className="truncate text-sm font-normal text-black">
                            {item.title}
                          </p>
                          <span className="shrink-0 text-[11px] font-light text-[#B8B8B8]">
                            {formatDistanceToNow(itemDate(item), {
                              addSuffix: true,
                            })}
                          </span>
                        </div>
                        <p className="mt-0.5 text-xs font-light text-[#6B6B6B]">
                          {item.body}
                        </p>
                      </div>
                    </div>
                  );

                  return item.url ? (
                    <a
                      key={item.id}
                      href={item.url}
                      className="block active:scale-[0.99]"
                    >
                      {content}
                    </a>
                  ) : (
                    <div key={item.id}>{content}</div>
                  );
                })}
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
