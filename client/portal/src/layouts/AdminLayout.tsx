import {
  IconAdjustmentsHorizontal,
  IconBell,
  IconCalendar,
  IconChevronLeft,
  IconClipboardList,
  IconDoorEnter,
  IconHeartHandshake,
  IconLink,
  IconMessage,
  IconScan,
  IconSpeakerphone,
  IconStar,
  IconTrophy,
  IconUserCheck,
  IconUsers,
} from "@tabler/icons-react";
import { useLayoutEffect, useState } from "react";
import { Outlet, useNavigate } from "react-router";

import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { OnboardingGate } from "@/pages/admin/_shared";
import { UserSettingsDialog } from "@/pages/hacker/settings";
import { SettingsDialog } from "@/pages/superadmin";
import { themeClass, useApplyPortalTheme, useTheme } from "@/shared/hooks";
import { cn } from "@/shared/lib/utils";
import { useUserStore } from "@/shared/stores";

import {
  PortalSidebar,
  type SidebarMenuAction,
  type SidebarNavItem,
  type SidebarNavSection,
} from "./PortalSidebar";

const APPLICANTS_NAV: SidebarNavItem[] = [
  {
    label: "All Applicants",
    to: "/admin/all-applicants",
    icon: IconUsers,
    end: false,
  },
  { label: "Reviews", to: "/admin/reviews", icon: IconUserCheck, end: false },
];

const EVENT_NAV: SidebarNavItem[] = [
  { label: "Scans", to: "/admin/scans", icon: IconScan, end: false },
  { label: "Schedule", to: "/admin/schedule", icon: IconCalendar, end: false },
  {
    label: "Sponsors",
    to: "/admin/sponsors",
    icon: IconHeartHandshake,
    end: false,
  },
  { label: "FAQ", to: "/admin/faq", icon: IconMessage, end: false },
  { label: "Tracks", to: "/admin/tracks", icon: IconTrophy, end: false },
];

const SUPER_ADMIN_NAV: SidebarNavItem[] = [
  {
    label: "Forms",
    to: "/admin/sa/forms",
    icon: IconClipboardList,
    end: false,
  },
  { label: "Reviews", to: "/admin/sa/reviews", icon: IconStar, end: false },
  {
    label: "Users",
    to: "/admin/sa/user-management",
    icon: IconUsers,
    end: false,
  },
  {
    label: "Notifications",
    to: "/admin/sa/notifications",
    icon: IconBell,
    end: false,
  },
  {
    label: "Hacker Links",
    to: "/admin/sa/hacker-links",
    icon: IconLink,
    end: false,
  },
  {
    label: "Referrals",
    to: "/admin/sa/referrals",
    icon: IconSpeakerphone,
    end: false,
  },
  {
    label: "Walk-In Queue",
    to: "/admin/sa/walk-in-queue",
    icon: IconDoorEnter,
    end: false,
  },
];

export default function AdminLayout() {
  const navigate = useNavigate();
  const isSuperAdmin = useUserStore((s) => s.user?.role === "super_admin");
  const [settingsOpen, setSettingsOpen] = useState(false);
  const theme = useTheme();
  useApplyPortalTheme(theme);

  // On <body> rather than the wrapper so Radix portals are covered too. The
  // hacker-side custom cursors in index.css are switched off under this class.
  useLayoutEffect(() => {
    document.body.classList.add("admin-portal");
    return () => document.body.classList.remove("admin-portal");
  }, []);

  const sections: SidebarNavSection[] = [
    { label: "Applicants", items: APPLICANTS_NAV },
    { label: "Event", items: EVENT_NAV },
  ];
  if (isSuperAdmin) {
    sections.push({ label: "Super Admin", items: SUPER_ADMIN_NAV });
  }
  const menuActions: SidebarMenuAction[] = isSuperAdmin
    ? [
        {
          label: "Hackathon Settings",
          icon: IconAdjustmentsHorizontal,
          onSelect: () => setSettingsOpen(true),
        },
      ]
    : [];

  return (
    <SidebarProvider className={cn(themeClass(theme), "h-svh min-h-0!")}>
      <OnboardingGate />
      <UserSettingsDialog />
      <PortalSidebar
        portal="admin"
        theme={theme}
        sections={sections}
        menuActions={menuActions}
      />
      {isSuperAdmin && (
        <SettingsDialog open={settingsOpen} onOpenChange={setSettingsOpen} />
      )}
      <SidebarInset className="overflow-hidden">
        {/* Mobile: the admin portal is scan-only, so there is no sidebar nav.
            Replace the sidebar toggle with a back button to the hacker
            settings (Profile) page. Hidden on desktop, where the sidebar
            provides navigation. */}
        <header className="flex items-center gap-2 border-b px-4 py-2 md:hidden">
          <button
            type="button"
            onClick={() => navigate("/app/profile")}
            aria-label="Back to settings"
            className="-ml-2 flex size-9 items-center justify-center rounded-full text-foreground transition-colors hover:bg-muted"
          >
            <IconChevronLeft className="size-5" strokeWidth={1.75} />
          </button>
        </header>
        <div className="flex flex-1 flex-col p-4 min-h-0 min-w-0">
          <Outlet />
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}
