import { useEffect, useState } from "react";

import { useIsMobile } from "@/shared/hooks/use-mobile";
import { useUserStore } from "@/shared/stores";

import { fetchOnboardingStatus } from "../api";
import { OnboardingDialog } from "./OnboardingDialog";

/**
 * Opens the onboarding form the first time a super admin lands on the admin
 * portal while required hackathon settings are still unset. Dismissing it
 * ("Later") keeps it closed until the next page load.
 */
export function OnboardingGate() {
  const user = useUserStore((s) => s.user);
  const isSuperAdmin = user?.role === "super_admin";
  const isMobile = useIsMobile();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!isSuperAdmin || isMobile) return;

    const controller = new AbortController();
    const check = async () => {
      const res = await fetchOnboardingStatus(controller.signal);
      if (controller.signal.aborted) return;
      if (res.status === 200 && res.data && !res.data.complete) {
        setOpen(true);
      }
    };

    check();
    return () => controller.abort();
  }, [isMobile, isSuperAdmin]);

  if (!isSuperAdmin || isMobile) return null;

  return <OnboardingDialog open={open} onOpenChange={setOpen} />;
}
