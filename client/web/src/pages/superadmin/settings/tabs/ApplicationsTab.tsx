import { useEffect, useState } from "react";
import { toast } from "sonner";

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
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { errorAlert, getRequest, putRequest } from "@/shared/lib/api";

export default function ApplicationsTab() {
  const [applicationsEnabled, setApplicationsEnabled] = useState(true);
  const [toggleLoading, setToggleLoading] = useState(true);
  const [toggleSaving, setToggleSaving] = useState(false);
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);

  useEffect(() => {
    async function fetchSettings() {
      const res = await getRequest<{ enabled: boolean }>(
        "/applications/enabled",
        "applications enabled",
      );

      if (res.status === 200 && res.data) {
        setApplicationsEnabled(res.data.enabled);
      } else {
        errorAlert(res);
      }

      setToggleLoading(false);
    }

    fetchSettings();
  }, []);

  async function handleToggle(nextValue: boolean) {
    if (!nextValue) {
      setIsConfirmOpen(true);
      return;
    }
    await saveToggle(nextValue);
  }

  async function saveToggle(nextValue: boolean) {
    setToggleSaving(true);
    const res = await putRequest<{ enabled: boolean }>(
      "/superadmin/settings/applications-enabled",
      { enabled: nextValue },
      "applications enabled",
    );

    if (res.status === 200 && res.data) {
      setApplicationsEnabled(res.data.enabled);
      toast.success(
        res.data.enabled
          ? "Applications are now open."
          : "Applications are now closed.",
      );
    } else {
      errorAlert(res);
    }

    setToggleSaving(false);
  }

  return (
    <div className="space-y-4">
      <h3 className="text-lg text-zinc-100">Applications</h3>
      <p className="text-sm text-zinc-400">
        Manage applications, and enable or disable them.
      </p>

      <div className="bg-zinc-900 rounded-md p-4">
        <div className="flex items-center justify-between gap-4">
          <div className="space-y-1">
            <Label
              htmlFor="applications-toggle"
              className="text-sm font-medium text-zinc-100 cursor-pointer"
            >
              Application Submissions
            </Label>
            <p className="text-xs text-zinc-500">
              When enabled, hackers can submit their applications.
            </p>
          </div>
          <Switch
            checked={applicationsEnabled}
            className="data-[state=checked]:bg-green-500 data-[state=unchecked]:bg-red-500"
            disabled={toggleLoading || toggleSaving}
            id="applications-toggle"
            onCheckedChange={handleToggle}
          />
        </div>
      </div>

      <AlertDialog open={isConfirmOpen} onOpenChange={setIsConfirmOpen}>
        <AlertDialogContent className="border-zinc-700 bg-zinc-900">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-zinc-100">
              Close applications?
            </AlertDialogTitle>
            <AlertDialogDescription className="text-zinc-400">
              Hackers will no longer be able to submit or edit their
              applications. You can reopen applications at any time.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="border-zinc-600 bg-zinc-800 text-zinc-100 hover:bg-zinc-700 hover:text-zinc-100">
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={() => saveToggle(false)}
              className="bg-red-500 text-white hover:bg-red-400"
            >
              Close Applications
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
