import { useEffect, useState } from "react";
import { toast } from "sonner";

import { Switch } from "@/components/ui/switch";
import { errorAlert } from "@/shared/lib/api";

import { fetchTravelRequestsEnabled, setTravelRequestsEnabled } from "../api";

export function TravelRequestsSetting() {
  const [enabled, setEnabled] = useState<boolean | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    fetchTravelRequestsEnabled(controller.signal).then((res) => {
      if (controller.signal.aborted) return;
      if (res.status === 200 && res.data) {
        setEnabled(res.data.enabled);
      } else {
        errorAlert(res);
      }
    });
    return () => controller.abort();
  }, []);

  async function handleToggle(next: boolean) {
    setSaving(true);
    const res = await setTravelRequestsEnabled(next);
    if (res.status === 200 && res.data) {
      setEnabled(res.data.enabled);
      toast.success(
        res.data.enabled
          ? "Applicants can now request travel reimbursement."
          : "Travel reimbursement questions are now hidden from applicants.",
      );
    } else {
      errorAlert(res);
    }
    setSaving(false);
  }

  return (
    <div className="flex items-center justify-between gap-4 rounded-lg border p-4">
      <div>
        <p className="text-sm font-light">Travel reimbursement requests</p>
        <p className="mt-1 text-xs font-light text-muted-foreground">
          When enabled, applicants are asked whether they want travel
          reimbursement. Turn this off after the travel deadline: the travel
          questions disappear from the application and new submissions skip
          travel review. Admins still see travel answers already submitted.
        </p>
      </div>
      <Switch
        checked={enabled ?? false}
        disabled={enabled === null || saving}
        onCheckedChange={handleToggle}
        aria-label="Travel reimbursement requests"
      />
    </div>
  );
}
