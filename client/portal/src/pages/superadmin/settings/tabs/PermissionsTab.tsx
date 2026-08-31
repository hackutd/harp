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
import {
  errorAlert,
  getRequest,
  postRequest,
  putRequest,
} from "@/shared/lib/api";
import { DEFAULT_FEATURE_FLAGS } from "@/shared/lib/feature-defaults";

interface PermissionToggleProps {
  id: string;
  label: string;
  description: string;
  checked: boolean;
  disabled: boolean;
  onCheckedChange: (next: boolean) => void;
}

function PermissionToggle({
  id,
  label,
  description,
  checked,
  disabled,
  onCheckedChange,
}: PermissionToggleProps) {
  return (
    <div className="bg-zinc-900 rounded-md p-4">
      <div className="flex items-center justify-between gap-4">
        <div className="space-y-1">
          <Label
            htmlFor={id}
            className="text-sm font-medium text-zinc-100 cursor-pointer"
          >
            {label}
          </Label>
          <p className="text-xs text-zinc-500">{description}</p>
        </div>
        <Switch
          checked={checked}
          className="data-[state=checked]:bg-green-500 data-[state=unchecked]:bg-red-500"
          disabled={disabled}
          id={id}
          onCheckedChange={onCheckedChange}
        />
      </div>
    </div>
  );
}

export default function PermissionsTab() {
  const [applicationsEnabled, setApplicationsEnabled] = useState<boolean>(
    DEFAULT_FEATURE_FLAGS.applicationsEnabled,
  );
  const [rsvpEnabled, setRSVPEnabled] = useState(true);
  const [travelRSVPEnabled, setTravelRSVPEnabled] = useState(true);
  const [adminScheduleEditEnabled, setAdminScheduleEditEnabled] =
    useState(true);
  const [adminSponsorEditEnabled, setAdminSponsorEditEnabled] = useState(true);
  const [adminFAQEditEnabled, setAdminFAQEditEnabled] = useState(true);

  const [loading, setLoading] = useState(true);
  const [applicationsSaving, setApplicationsSaving] = useState(false);
  const [rsvpSaving, setRSVPSaving] = useState(false);
  const [travelRSVPSaving, setTravelRSVPSaving] = useState(false);
  const [scheduleSaving, setScheduleSaving] = useState(false);
  const [sponsorSaving, setSponsorSaving] = useState(false);
  const [faqSaving, setFaqSaving] = useState(false);
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);

  useEffect(() => {
    async function fetchSettings() {
      const [
        applicationsRes,
        rsvpRes,
        travelRSVPRes,
        scheduleRes,
        sponsorRes,
        faqRes,
      ] = await Promise.all([
        getRequest<{ enabled: boolean }>(
          "/applications/enabled",
          "applications enabled",
        ),
        getRequest<{ enabled: boolean }>(
          "/superadmin/settings/rsvp-enabled",
          "RSVP enabled",
        ),
        getRequest<{ enabled: boolean }>(
          "/superadmin/settings/travel-rsvp-enabled",
          "travel RSVP enabled",
        ),
        getRequest<{ enabled: boolean }>(
          "/superadmin/settings/admin-schedule-edit-toggle",
          "admin schedule edit toggle",
        ),
        getRequest<{ enabled: boolean }>(
          "/superadmin/settings/admin-sponsor-edit-toggle",
          "admin sponsor edit toggle",
        ),
        getRequest<{ enabled: boolean }>(
          "/superadmin/settings/admin-faq-edit-toggle",
          "admin FAQ edit toggle",
        ),
      ]);

      if (applicationsRes.status === 200 && applicationsRes.data) {
        setApplicationsEnabled(applicationsRes.data.enabled);
      } else {
        errorAlert(applicationsRes);
      }

      if (rsvpRes.status === 200 && rsvpRes.data) {
        setRSVPEnabled(rsvpRes.data.enabled);
      } else {
        errorAlert(rsvpRes);
      }

      if (travelRSVPRes.status === 200 && travelRSVPRes.data) {
        setTravelRSVPEnabled(travelRSVPRes.data.enabled);
      } else {
        errorAlert(travelRSVPRes);
      }

      if (scheduleRes.status === 200 && scheduleRes.data) {
        setAdminScheduleEditEnabled(scheduleRes.data.enabled);
      } else {
        errorAlert(scheduleRes);
      }

      if (sponsorRes.status === 200 && sponsorRes.data) {
        setAdminSponsorEditEnabled(sponsorRes.data.enabled);
      } else {
        errorAlert(sponsorRes);
      }

      if (faqRes.status === 200 && faqRes.data) {
        setAdminFAQEditEnabled(faqRes.data.enabled);
      } else {
        errorAlert(faqRes);
      }

      setLoading(false);
    }

    fetchSettings();
  }, []);

  async function handleApplicationsToggle(nextValue: boolean) {
    if (!nextValue) {
      setIsConfirmOpen(true);
      return;
    }
    await saveApplications(nextValue);
  }

  async function saveApplications(nextValue: boolean) {
    setApplicationsSaving(true);
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

    setApplicationsSaving(false);
  }

  async function handleRSVPToggle(nextValue: boolean) {
    setRSVPSaving(true);
    const res = await putRequest<{ enabled: boolean }>(
      "/superadmin/settings/rsvp-enabled",
      { enabled: nextValue },
      "RSVP enabled",
    );

    if (res.status === 200 && res.data) {
      setRSVPEnabled(res.data.enabled);
      toast.success(
        res.data.enabled ? "RSVPs are now open." : "RSVPs are now closed.",
      );
    } else {
      errorAlert(res);
    }

    setRSVPSaving(false);
  }

  async function handleTravelRSVPToggle(nextValue: boolean) {
    setTravelRSVPSaving(true);
    const res = await putRequest<{ enabled: boolean }>(
      "/superadmin/settings/travel-rsvp-enabled",
      { enabled: nextValue },
      "travel RSVP enabled",
    );

    if (res.status === 200 && res.data) {
      setTravelRSVPEnabled(res.data.enabled);
      toast.success(
        res.data.enabled
          ? "Travel forms are now open."
          : "Travel forms are now closed.",
      );
    } else {
      errorAlert(res);
    }

    setTravelRSVPSaving(false);
  }

  async function handleScheduleToggle(nextValue: boolean) {
    setScheduleSaving(true);
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

    setScheduleSaving(false);
  }

  async function handleSponsorToggle(nextValue: boolean) {
    setSponsorSaving(true);
    const res = await postRequest<{ enabled: boolean }>(
      "/superadmin/settings/admin-sponsor-edit-toggle",
      { enabled: nextValue },
      "admin sponsor edit toggle",
    );

    if (res.status === 200 && res.data) {
      setAdminSponsorEditEnabled(res.data.enabled);
      toast.success(
        res.data.enabled
          ? "Admins can now edit sponsors."
          : "Admins are now blocked from editing sponsors.",
      );
    } else {
      errorAlert(res);
    }

    setSponsorSaving(false);
  }

  async function handleFAQToggle(nextValue: boolean) {
    setFaqSaving(true);
    const res = await postRequest<{ enabled: boolean }>(
      "/superadmin/settings/admin-faq-edit-toggle",
      { enabled: nextValue },
      "admin FAQ edit toggle",
    );

    if (res.status === 200 && res.data) {
      setAdminFAQEditEnabled(res.data.enabled);
      toast.success(
        res.data.enabled
          ? "Admins can now edit FAQs."
          : "Admins are now blocked from editing FAQs.",
      );
    } else {
      errorAlert(res);
    }

    setFaqSaving(false);
  }

  return (
    <div className="space-y-4">
      <h3 className="text-lg text-zinc-100">Permissions</h3>
      <p className="text-sm text-zinc-400">
        Control application submissions and what admins are allowed to edit.
      </p>

      <PermissionToggle
        id="applications-toggle"
        label="Application Submissions"
        description="When enabled, hackers can submit their applications."
        checked={applicationsEnabled}
        disabled={loading || applicationsSaving}
        onCheckedChange={handleApplicationsToggle}
      />

      <PermissionToggle
        id="rsvp-toggle"
        label="RSVP Submissions"
        description="When enabled, accepted hackers can RSVP to claim or decline their spot."
        checked={rsvpEnabled}
        disabled={loading || rsvpSaving}
        onCheckedChange={handleRSVPToggle}
      />

      <PermissionToggle
        id="travel-rsvp-toggle"
        label="Travel Form Submissions"
        description="When enabled, hackers with approved travel reimbursement can submit their travel details and receipts."
        checked={travelRSVPEnabled}
        disabled={loading || travelRSVPSaving}
        onCheckedChange={handleTravelRSVPToggle}
      />

      <PermissionToggle
        id="admin-schedule-edit-toggle"
        label="Admin Schedule Editing"
        description="When disabled, only super admins can create, update, or delete schedule entries."
        checked={adminScheduleEditEnabled}
        disabled={loading || scheduleSaving}
        onCheckedChange={handleScheduleToggle}
      />

      <PermissionToggle
        id="admin-sponsor-edit-toggle"
        label="Admin Sponsor Editing"
        description="When disabled, only super admins can create, update, or delete sponsors."
        checked={adminSponsorEditEnabled}
        disabled={loading || sponsorSaving}
        onCheckedChange={handleSponsorToggle}
      />

      <PermissionToggle
        id="admin-faq-edit-toggle"
        label="Admin FAQ Editing"
        description="When disabled, only super admins can create, update, or delete FAQs."
        checked={adminFAQEditEnabled}
        disabled={loading || faqSaving}
        onCheckedChange={handleFAQToggle}
      />

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
              onClick={() => saveApplications(false)}
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
