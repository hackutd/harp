import { toast } from "sonner";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { usePushSubscription } from "@/shared/push";

export function NotificationsCard() {
  const { supported, permission, enabled, loading, enable, disable } =
    usePushSubscription();

  const blocked = supported && permission === "denied";

  const handleToggle = async (next: boolean) => {
    if (next) {
      const result = await enable();
      if (result === "granted") {
        toast.success("Notifications enabled", {
          description:
            "We'll let you know when reviews and announcements drop.",
        });
      } else if (result === "denied") {
        toast.error("Notifications blocked", {
          description:
            "Allow notifications for this site in your browser settings to receive updates.",
        });
      } else {
        toast.error("Couldn't enable notifications. Please try again.");
      }
    } else {
      await disable();
      toast.success("Notifications disabled");
    }
  };

  return (
    <Card className="mt-6">
      <CardHeader>
        <CardTitle>Notifications</CardTitle>
        <CardDescription>
          Get push notifications about your application status and event
          announcements
        </CardDescription>
      </CardHeader>
      <CardContent>
        {!supported ? (
          <p className="text-sm text-gray-600">
            Push notifications aren't supported in this browser.
          </p>
        ) : (
          <div className="flex items-center justify-between gap-4">
            <div className="space-y-1">
              <Label htmlFor="push-notifications">
                Enable push notifications
              </Label>
              {blocked && (
                <p className="text-sm text-gray-600">
                  Notifications are blocked. Allow them for this site in your
                  browser settings to turn them on.
                </p>
              )}
            </div>
            <Switch
              id="push-notifications"
              checked={enabled}
              onCheckedChange={handleToggle}
              disabled={loading || blocked}
            />
          </div>
        )}
      </CardContent>
    </Card>
  );
}
