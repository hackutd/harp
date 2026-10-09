import { useEffect, useState } from "react";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { getRequest } from "@/shared/lib/api";
import {
  useAttendeeStore,
  useSettingsDialogStore,
  useUserStore,
} from "@/shared/stores";
import type { Application } from "@/types";

import { DirectoryVisibilityRow } from "../directory/components/ProfileAbout";
import { useDirectoryStore } from "../directory/store";
import { AccountRows } from "./components/AccountRows";
import { AppearanceRow } from "./components/AppearanceRow";
import { InstallAppRow } from "./components/InstallAppRow";
import { PushNotificationsRow } from "./components/PushNotificationsRow";
import { ResumeRow } from "./components/ResumeRow";
import { SettingsGroup } from "./components/SettingsGroup";

// Outlined lists: the dialog is already the card.
const GROUP_CLASS = "border border-ink/10";

/**
 * The account Settings dialog, rendered once by each portal layout and opened
 * through useSettingsDialogStore. It loads what its rows need each time it
 * opens, so it works the same from the admin portal.
 */
export function UserSettingsDialog() {
  const open = useSettingsDialogStore((s) => s.open);
  const setOpen = useSettingsDialogStore((s) => s.setOpen);
  const userId = useUserStore((s) => s.user?.id ?? null);

  const [application, setApplication] = useState<Application | null>(null);
  const [applicationLoading, setApplicationLoading] = useState(false);

  const attendeeFor = useAttendeeStore((s) => s.userId);
  const confirmed = useAttendeeStore((s) => s.confirmed);
  const fetchAttendee = useAttendeeStore((s) => s.fetchAttendee);
  const attendee = confirmed && attendeeFor != null && attendeeFor === userId;
  const directoryMe = useDirectoryStore((s) => s.me);
  const fetchDirectoryMe = useDirectoryStore((s) => s.fetchMe);
  // Directory visibility only exists once the RSVP is confirmed.
  const about = attendee && directoryMe?.eligible ? directoryMe : null;

  useEffect(() => {
    if (!open || !userId) return;
    const controller = new AbortController();
    const load = async () => {
      setApplicationLoading(true);
      const res = await getRequest<Application>(
        "/applications/me",
        "application",
        controller.signal,
      );
      if (controller.signal.aborted) return;
      setApplication(res.status === 200 && res.data ? res.data : null);
      setApplicationLoading(false);
    };
    load();
    return () => controller.abort();
  }, [open, userId]);

  // The hacker layout already knows whether this is an attendee; the admin
  // portal does not.
  useEffect(() => {
    if (!open || !userId || attendeeFor === userId) return;
    const controller = new AbortController();
    fetchAttendee(userId, controller.signal);
    return () => controller.abort();
  }, [open, userId, attendeeFor, fetchAttendee]);

  useEffect(() => {
    if (!open || !attendee) return;
    const controller = new AbortController();
    fetchDirectoryMe(controller.signal);
    return () => controller.abort();
  }, [open, attendee, fetchDirectoryMe]);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="flex max-h-[90svh] flex-col gap-0 overflow-hidden p-0 sm:max-w-2xl lg:max-w-4xl max-sm:top-0 max-sm:left-0 max-sm:h-svh max-sm:max-h-none max-sm:max-w-none max-sm:translate-x-0 max-sm:translate-y-0 max-sm:rounded-none max-sm:border-0">
        <DialogHeader className="shrink-0 border-b border-ink/10 px-5 py-4 text-left">
          <DialogTitle className="text-lg font-light tracking-tight text-ink">
            Settings
          </DialogTitle>
          <DialogDescription className="sr-only">
            Notifications, appearance, your resume, and your account.
          </DialogDescription>
        </DialogHeader>
        <div className="min-h-0 flex-1 space-y-6 overflow-y-auto px-5 py-5">
          <SettingsGroup title="Preferences" className={GROUP_CLASS}>
            <InstallAppRow />
            {about && <DirectoryVisibilityRow me={about} />}
            <PushNotificationsRow />
            <AppearanceRow />
            <ResumeRow
              application={application}
              loading={applicationLoading && !application}
              onApplicationChange={setApplication}
            />
          </SettingsGroup>
          <SettingsGroup title="Account" className={GROUP_CLASS}>
            <AccountRows />
          </SettingsGroup>
        </div>
      </DialogContent>
    </Dialog>
  );
}
