import { IconBell } from "@tabler/icons-react";
import { toast } from "sonner";

import { Switch } from "@/components/ui/switch";
import { usePushSubscription } from "@/shared/push/usePushSubscription";

export function PushNotificationsRow() {
  const push = usePushSubscription();

  const handleToggle = async (checked: boolean) => {
    if (checked) {
      const result = await push.enable();
      if (result === "granted") {
        toast.success("Notifications enabled");
      } else if (result === "denied") {
        toast.error("Notifications blocked", {
          description:
            "Allow notifications for this site in your browser settings to receive updates.",
        });
      } else {
        toast.error("Couldn't enable notifications. Please try again.");
      }
    } else {
      await push.disable();
      toast.success("Notifications disabled");
    }
  };

  return (
    <div className="flex min-h-[68px] items-center justify-between px-5 py-4">
      <div className="flex items-center gap-3">
        <IconBell className="size-4.5 text-ink" strokeWidth={1.5} />
        <div>
          <label
            htmlFor="settings-push-notifications"
            className="block text-sm font-normal text-ink"
          >
            Push notifications
          </label>
          <p className="text-xs font-light text-ink/65">
            {push.supported
              ? "Decision & event alerts"
              : "Not supported in this browser"}
          </p>
        </div>
      </div>
      <Switch
        id="settings-push-notifications"
        checked={push.enabled}
        disabled={!push.supported || push.loading}
        onCheckedChange={handleToggle}
      />
    </div>
  );
}
