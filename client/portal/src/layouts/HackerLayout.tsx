import {
  IconBell,
  IconBellFilled,
  IconCalendarMonth,
  IconCalendarMonthFilled,
  IconHome,
  IconHomeFilled,
  IconTicket,
  IconTicketFilled,
  IconUser,
  IconUserFilled,
} from "@tabler/icons-react";
import { NavLink, Outlet, useLocation } from "react-router";

import { InstallPromptHost } from "@/components/InstallPromptHost";
import { PushPromptHost } from "@/components/PushPromptHost";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { UserSettingsDialog } from "@/pages/hacker/settings";
import { themeClass, useApplyPortalTheme, useTheme } from "@/shared/hooks";
import { cn } from "@/shared/lib/utils";

import { PortalSidebar, type SidebarNavItem as NavItem } from "./PortalSidebar";

const NAV_ITEMS: NavItem[] = [
  {
    label: "Home",
    to: "/app",
    icon: IconHome,
    activeIcon: IconHomeFilled,
    end: true,
  },
  {
    label: "Scan",
    to: "/app/scan",
    icon: IconTicket,
    activeIcon: IconTicketFilled,
    end: false,
  },
  {
    label: "Schedule",
    to: "/app/schedule",
    icon: IconCalendarMonth,
    activeIcon: IconCalendarMonthFilled,
    end: false,
  },
  {
    label: "Notifications",
    to: "/app/notifications",
    icon: IconBell,
    activeIcon: IconBellFilled,
    end: false,
  },
  {
    label: "Profile",
    to: "/app/profile",
    icon: IconUser,
    activeIcon: IconUserFilled,
    end: false,
  },
];

// The mobile tab bar drops Notifications (the dashboard feed links to it), so
// the remaining tabs keep room for their labels.
const NOTIFICATIONS_PATH = "/app/notifications";

// Uniform inset (rem) applied on every side of the bottom-nav bubble so the
// gap around the active bubble is identical top/bottom/left/right. Matches the
// bar's padding (p-[BOTTOM_NAV_PAD]) and the bubble's inset-y.
const BOTTOM_NAV_PAD = 0.375;

function activeIndex(items: NavItem[], pathname: string): number {
  return items.findIndex((item) =>
    item.end
      ? pathname === item.to
      : pathname === item.to || pathname.startsWith(item.to + "/"),
  );
}

export default function HackerLayout() {
  const location = useLocation();
  const theme = useTheme();
  useApplyPortalTheme(theme);

  const tabItems = NAV_ITEMS.filter((item) => item.to !== NOTIFICATIONS_PATH);
  const index = activeIndex(tabItems, location.pathname);
  const hasActive = index >= 0;

  // The application wizard has its own fixed bottom bar, so the mobile tab
  // bar is hidden there to avoid overlap.
  const hideMobileNav = location.pathname.startsWith("/app/apply");

  return (
    <SidebarProvider
      className={cn(themeClass(theme), "min-h-svh bg-canvas text-ink")}
    >
      {/* Onboarding prompts live here, not in providers.tsx, so they never
          appear on the admin portal or the public auth pages. */}
      <InstallPromptHost />
      <PushPromptHost />
      <UserSettingsDialog />
      <PortalSidebar
        portal="hacker"
        theme={theme}
        sections={[{ items: NAV_ITEMS }]}
      />

      {/* Page content */}
      <SidebarInset
        className={cn(
          "zero-hacker-surface bg-canvas",
          hideMobileNav
            ? "pb-0"
            : "pb-[calc(6rem+env(safe-area-inset-bottom))] md:pb-0",
        )}
      >
        <div key={location.pathname} className="animate-page-enter">
          <Outlet />
        </div>
      </SidebarInset>

      {/* Mobile bottom tab bar: a floating glass capsule, with a scroll-edge
          blur behind it so content dissolves under the bar. It floats a bit
          above the home indicator (HIG: never flush against it) and keeps a
          minimum gap when there is no inset, e.g. above Safari's toolbar. */}
      {!hideMobileNav && (
        <div className="md:hidden">
          <div aria-hidden className="zero-tabbar-edge z-30" />
          <div
            className="fixed inset-x-3 z-40"
            style={{
              bottom:
                "max(1.25rem, calc(0.5rem + env(safe-area-inset-bottom)))",
            }}
          >
            <nav
              aria-label="Primary"
              className="zero-tabbar"
              style={{ padding: `${BOTTOM_NAV_PAD}rem` }}
            >
              {/* Always mounted so it slides between tabs rather than
                  remounting; it fades out on routes outside the tab set. */}
              <span
                aria-hidden
                className="zero-tabbar-pill"
                style={{
                  top: `${BOTTOM_NAV_PAD}rem`,
                  bottom: `${BOTTOM_NAV_PAD}rem`,
                  left: `${BOTTOM_NAV_PAD}rem`,
                  width: `calc((100% - ${2 * BOTTOM_NAV_PAD}rem) / ${tabItems.length})`,
                  transform: `translateX(${Math.max(index, 0) * 100}%)`,
                  opacity: hasActive ? 1 : 0,
                }}
              />
              {tabItems.map(({ label, to, icon, activeIcon, end }) => (
                <NavLink
                  key={to}
                  to={to}
                  end={end}
                  className="zero-tabbar-item"
                >
                  {({ isActive }) => {
                    const Icon = isActive ? (activeIcon ?? icon) : icon;
                    return (
                      <>
                        <Icon
                          className="size-[1.375rem]"
                          strokeWidth={isActive ? 2 : 1.75}
                        />
                        <span className="zero-tabbar-label">{label}</span>
                      </>
                    );
                  }}
                </NavLink>
              ))}
            </nav>
          </div>
        </div>
      )}
    </SidebarProvider>
  );
}
