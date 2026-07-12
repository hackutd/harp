import type { LucideIcon } from "lucide-react";
import {
  CalendarDays,
  FileText,
  House,
  LogOut,
  ScanLine,
  User,
} from "lucide-react";
import { NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import { signOut } from "supertokens-auth-react/recipe/session";

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
  { label: "Application", to: "/app/apply", icon: FileText, end: false },
  { label: "Profile", to: "/app/profile", icon: User, end: false },
];

// Vertical item height (h-10 = 40px) plus gap (gap-1 = 4px).
const SIDEBAR_STEP_PX = 44;

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

export default function HackerLayout() {
  const clearUser = useUserStore((s) => s.clearUser);
  const navigate = useNavigate();
  const location = useLocation();

  const index = activeIndex(location.pathname);
  const hasActive = index >= 0;

  // The application wizard has its own fixed bottom bar, so the mobile tab
  // bar is hidden there to avoid overlap.
  const hideMobileNav = location.pathname.startsWith("/app/apply");

  const handleLogout = async () => {
    await signOut();
    clearUser();
    navigate("/", { replace: true });
  };

  return (
    <div className="min-h-svh bg-white">
      {/* Desktop left sidebar */}
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-56 flex-col border-r border-[#E5E5E5] bg-white md:flex">
        <div className="px-4 pt-5 pb-4">
          <p className="text-base font-medium tracking-tight text-black">
            HARP
          </p>
          <p className="text-xs font-light text-[#8A8A8A]">HackUTD 2026</p>
        </div>
        <div className="flex-1 px-2">
          <nav className="relative flex flex-col gap-1">
            {hasActive && (
              <span
                aria-hidden
                className="pointer-events-none absolute inset-x-0 top-0 h-10 rounded-full bg-[#EDEDED] transition-transform duration-300 ease-out"
                style={{
                  transform: `translateY(${index * SIDEBAR_STEP_PX}px)`,
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
                    "relative z-10 flex h-10 items-center gap-2.5 rounded-full px-3 text-sm transition-colors",
                    isActive
                      ? "font-medium text-black"
                      : "font-normal text-[#6B6B6B] hover:text-black",
                  )
                }
              >
                <Icon className="size-4.5" strokeWidth={1.5} />
                {label}
              </NavLink>
            ))}
          </nav>
        </div>
        <div className="px-2 pb-4">
          <button
            onClick={handleLogout}
            className="flex h-10 w-full items-center gap-2.5 rounded-full px-3 text-sm font-normal text-[#6B6B6B] transition-colors hover:bg-[#F0F0F0] hover:text-black"
          >
            <LogOut className="size-4.5" strokeWidth={1.5} />
            Sign out
          </button>
        </div>
      </aside>

      {/* Page content */}
      <main
        className={cn("md:pb-0 md:pl-56", hideMobileNav ? "pb-0" : "pb-24")}
      >
        <div key={location.pathname} className="animate-page-enter">
          <Outlet />
        </div>
      </main>

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
    </div>
  );
}
