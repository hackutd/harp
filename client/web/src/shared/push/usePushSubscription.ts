import { useCallback, useEffect, useState } from "react";

import { getCurrentSubscription, isPushSupported } from "./client";
import {
  disablePushSubscription,
  type EnablePushResult,
  enablePushSubscription,
} from "./subscription";

export type PushPermission = NotificationPermission | "unsupported";

export interface UsePushSubscriptionResult {
  /** Whether the browser supports Web Push at all. */
  supported: boolean;
  /** Current notification permission, or "unsupported". */
  permission: PushPermission;
  /** Whether an active push subscription currently exists. */
  enabled: boolean;
  /** True while the initial state loads or a toggle is in flight. */
  loading: boolean;
  enable: () => Promise<EnablePushResult>;
  disable: () => Promise<void>;
}

// Stateful wrapper around the push subscription flow, suitable for a toggle UI.
// Reads the current subscription on mount and keeps permission state in sync.
export function usePushSubscription(): UsePushSubscriptionResult {
  const supported = isPushSupported();
  const [permission, setPermission] = useState<PushPermission>(() =>
    supported ? Notification.permission : "unsupported",
  );
  const [enabled, setEnabled] = useState(false);
  const [loading, setLoading] = useState(supported);

  useEffect(() => {
    let active = true;
    (async () => {
      if (!supported) {
        setLoading(false);
        return;
      }
      const sub = await getCurrentSubscription();
      if (!active) return;
      setEnabled(!!sub);
      setPermission(Notification.permission);
      setLoading(false);
    })();
    return () => {
      active = false;
    };
  }, [supported]);

  const enable = useCallback(async (): Promise<EnablePushResult> => {
    if (!supported) return "error";
    setLoading(true);
    try {
      const result = await enablePushSubscription();
      setPermission(Notification.permission);
      setEnabled(result === "granted");
      return result;
    } catch {
      setEnabled(false);
      return "error";
    } finally {
      setLoading(false);
    }
  }, [supported]);

  const disable = useCallback(async () => {
    if (!supported) return;
    setLoading(true);
    try {
      await disablePushSubscription();
      setEnabled(false);
    } finally {
      setLoading(false);
    }
  }, [supported]);

  return { supported, permission, enabled, loading, enable, disable };
}
