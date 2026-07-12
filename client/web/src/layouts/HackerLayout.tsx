import type { LucideIcon } from "lucide-react";
import { Bell, CalendarDays, House, ScanLine, User } from "lucide-react";
import { NavLink, Outlet, useLocation } from "react-router-dom";

import {
  Sidebar,
  SidebarContent,
  SidebarHeader,
  SidebarInset,
  SidebarProvider,
  SidebarRail,
} from "@/components/ui/sidebar";
import { NavSection, NavUser } from "@/pages/admin/_shared";
import { cn } from "@/shared/lib/utils";
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

const SIDEBAR_NAV = NAV_ITEMS.map(({ label, to, icon }) => ({
  name: label,
  url: to,
  icon,
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
    <Sidebar collapsible="icon" className="hidden md:flex">
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

  return (
    <SidebarProvider className="min-h-svh bg-white">
      <HackerSidebar />

      {/* Page content */}
      <SidebarInset
        className={cn("bg-white", hideMobileNav ? "pb-0" : "pb-24 md:pb-0")}
      >
        <div key={location.pathname} className="animate-page-enter">
          <Outlet />
        </div>
      </SidebarInset>

      {/* Mobile bottom tab bar */}
      <div
        className={cn(
          "fixed inset-x-4 bottom-4 z-40 md:hidden",
          hideMobileNav && "hidden",
        )}
        style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
      >
        <nav
          className="relative flex rounded-full bg-black/80 shadow-[0_2px_16px_rgba(0,0,0,0.18)] backdrop-blur-sm"
          style={{ padding: `${BOTTOM_NAV_PAD}rem` }}
        >
          {hasActive && (
            <span
              aria-hidden
              className="pointer-events-none absolute rounded-full bg-white/15 transition-all duration-300 ease-out"
              style={{
                top: `${BOTTOM_NAV_PAD}rem`,
                bottom: `${BOTTOM_NAV_PAD}rem`,
                left: `calc(${BOTTOM_NAV_PAD}rem + ${index} * (100% - ${2 * BOTTOM_NAV_PAD}rem) / ${NAV_ITEMS.length})`,
                width: `calc((100% - ${2 * BOTTOM_NAV_PAD}rem) / ${NAV_ITEMS.length})`,
              }}
            />
          )}
          {NAV_ITEMS.map(({ label, to, icon: Icon, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              className={({ isActive }) =>
                cn(
                  "relative z-10 flex flex-1 flex-col items-center justify-center gap-0.5 rounded-full py-1.5 transition-colors active:scale-[0.98]",
                  isActive ? "text-white" : "text-white/60",
                )
              }
            >
              <Icon className="size-5" strokeWidth={1.5} />
              <span className="text-[10px] font-light">{label}</span>
            </NavLink>
          ))}
        </nav>
      </div>
    </SidebarProvider>
  );
}
