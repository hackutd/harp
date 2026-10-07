import type { LucideIcon } from "lucide-react";
import { Bell, CalendarDays, House, ScanLine, User } from "lucide-react";
import { useLayoutEffect } from "react";
import { NavLink, Outlet, useLocation } from "react-router";

import { InstallPromptHost } from "@/components/InstallPromptHost";
import { PushPromptHost } from "@/components/PushPromptHost";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarRail,
} from "@/components/ui/sidebar";
import { NavSection, NavUser } from "@/pages/admin/_shared";
import { cn } from "@/shared/lib/utils";
import { ZERODAY_LOGO, ZERODAY_URL } from "@/shared/lib/zeroday";
import { useUserStore } from "@/shared/stores";

interface NavItem {
  label: string;
  to: string;
  icon: LucideIcon;
  end: boolean;
}

const NAV_ITEMS: NavItem[] = [
  { label: "Home", to: "/app", icon: House, end: true },
  { label: "Scan", to: "/app/scan", icon: ScanLine, end: false },
  { label: "Schedule", to: "/app/schedule", icon: CalendarDays, end: false },
  { label: "Notifications", to: "/app/notifications", icon: Bell, end: false },
  { label: "Profile", to: "/app/profile", icon: User, end: false },
];

const SIDEBAR_NAV = NAV_ITEMS.map(({ label, to, icon, end }) => ({
  name: label,
  url: to,
  icon,
  end,
}));

// Uniform inset (rem) applied on every side of the bottom-nav bubble so the
// gap around the active bubble is identical top/bottom/left/right. Matches the
// bar's padding (p-[BOTTOM_NAV_PAD]) and the bubble's inset-y.
const BOTTOM_NAV_PAD = 0.375;

function activeIndex(pathname: string): number {
  return NAV_ITEMS.findIndex((item) =>
    item.end
      ? pathname === item.to
      : pathname === item.to || pathname.startsWith(item.to + "/"),
  );
}

function HackerSidebar() {
  const { user } = useUserStore();
  const location = useLocation();

  const userData = {
    name: "Hacker",
    email: user?.email || "",
    avatar: user?.profilePictureUrl || "",
  };

  return (
    <Sidebar
      collapsible="icon"
      className="hacker-zero-sidebar hidden border-white/10 md:flex"
    >
      <SidebarHeader>
        <NavUser user={userData} />
      </SidebarHeader>
      <SidebarContent>
        <NavSection
          label="Menu"
          items={SIDEBAR_NAV}
          currentPath={location.pathname}
        />
      </SidebarContent>
      <SidebarFooter className="border-t border-white/8">
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton asChild size="lg" tooltip="Back to Zero Day">
              <a href={ZERODAY_URL}>
                <img
                  src={ZERODAY_LOGO}
                  alt=""
                  aria-hidden
                  className="size-8 shrink-0 object-contain"
                />
                <div className="grid flex-1 text-left text-sm leading-tight">
                  <span className="truncate font-light">Back to Zero Day</span>
                  <span className="truncate text-xs text-white/45">
                    zeroday.hackutd.co
                  </span>
                </div>
              </a>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  );
}

export default function HackerLayout() {
  const location = useLocation();

  const index = activeIndex(location.pathname);
  const hasActive = index >= 0;

  // The application wizard has its own fixed bottom bar, so the mobile tab
  // bar is hidden there to avoid overlap.
  const hideMobileNav = location.pathname.startsWith("/app/apply");

  // Radix dialogs and menus render into document.body rather than inside the
  // layout wrapper. Scope the same hacker theme to those portals while this
  // layout is mounted, then remove it before entering an admin/public route.
  useLayoutEffect(() => {
    document.body.classList.add("hacker-zero-portals");
    return () => document.body.classList.remove("hacker-zero-portals");
  }, []);

  return (
    <SidebarProvider className="hacker-zero-theme min-h-svh bg-[#030409] text-white">
      {/* Onboarding prompts live here, not in providers.tsx, so they never
          appear on the admin portal or the public auth pages. */}
      <InstallPromptHost />
      <PushPromptHost />
      <HackerSidebar />

      {/* Page content */}
      <SidebarInset
        className={cn(
          "zero-hacker-surface bg-[#030409]",
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
                  width: `calc((100% - ${2 * BOTTOM_NAV_PAD}rem) / ${NAV_ITEMS.length})`,
                  transform: `translateX(${Math.max(index, 0) * 100}%)`,
                  opacity: hasActive ? 1 : 0,
                }}
              />
              {NAV_ITEMS.map(({ label, to, icon: Icon, end }) => (
                <NavLink
                  key={to}
                  to={to}
                  end={end}
                  className="zero-tabbar-item"
                >
                  {({ isActive }) => (
                    <>
                      <Icon
                        className="size-[1.375rem]"
                        strokeWidth={isActive ? 2 : 1.75}
                      />
                      <span className="zero-tabbar-label">{label}</span>
                    </>
                  )}
                </NavLink>
              ))}
            </nav>
          </div>
        </div>
      )}
    </SidebarProvider>
  );
}
