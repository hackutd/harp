import { useEffect, useState } from "react";
import { toast } from "sonner";

import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { errorAlert, getRequest, postRequest } from "@/shared/lib/api";

export default function ApplicationsTab() {
  const [adminScheduleEditEnabled, setAdminScheduleEditEnabled] =
    useState(true);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    async function fetchToggle() {
      const res = await getRequest<{ enabled: boolean }>(
        "/superadmin/settings/admin-schedule-edit-toggle",
        "admin schedule edit toggle",
      );

      if (res.status === 200 && res.data) {
        setAdminScheduleEditEnabled(res.data.enabled);
      } else {
        errorAlert(res);
      }

      setLoading(false);
    }

    fetchToggle();
  }, []);

  async function handleToggle(nextValue: boolean) {
    setSaving(true);
    const res = await postRequest<{ enabled: boolean }>(
      "/superadmin/settings/admin-schedule-edit-toggle",
      { enabled: nextValue },
      "admin schedule edit toggle",
    );

    if (res.status === 200 && res.data) {
      setAdminScheduleEditEnabled(res.data.enabled);
      toast.success(
        res.data.enabled
          ? "Admins can now edit schedule."
          : "Admins are now blocked from editing schedule.",
      );
    } else {
      errorAlert(res);
    }

    setSaving(false);
  }

  return (
    <div className="space-y-4">
      <h3 className="text-lg text-zinc-100">Applications</h3>
      <p className="text-sm text-zinc-400">
        Configure schedule editing permissions for admin users.
      </p>

      <div className="bg-zinc-900 rounded-md p-4">
        <div className="flex items-center justify-between gap-4">
          <div className="space-y-1">
            <Label
              htmlFor="admin-schedule-edit-toggle"
              className="text-sm font-medium text-zinc-100 cursor-pointer"
            >
              Admin Schedule Editing
            </Label>
            <p className="text-xs text-zinc-500">
              When disabled, only super admins can create, update, or delete
              schedule entries.
            </p>
          </div>
          <Switch
            checked={adminScheduleEditEnabled}
            className="data-[state=checked]:bg-green-500 data-[state=unchecked]:bg-red-500"
            disabled={loading || saving}
            id="admin-schedule-edit-toggle"
            onCheckedChange={handleToggle}
          />
        </div>
      </div>
    </div>
  );
}
