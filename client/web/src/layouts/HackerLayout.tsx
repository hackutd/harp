import {
  CalendarDays,
  FileText,
  House,
  LogOut,
  ScanLine,
  User,
} from "lucide-react";
import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { signOut } from "supertokens-auth-react/recipe/session";

import { cn } from "@/shared/lib/utils";
import { useUserStore } from "@/shared/stores";

const NAV_ITEMS = [
  { label: "Home", to: "/app", icon: House, end: true },
  { label: "Scan", to: "/app/scan", icon: ScanLine, end: false },
  { label: "Schedule", to: "/app/schedule", icon: CalendarDays, end: false },
  { label: "Application", to: "/app/apply", icon: FileText, end: false },
  { label: "Profile", to: "/app/profile", icon: User, end: false },
];

export default function HackerLayout() {
  const clearUser = useUserStore((s) => s.clearUser);
  const navigate = useNavigate();

  const handleLogout = async () => {
    await signOut();
    clearUser();
    navigate("/", { replace: true });
  };

  return (
    <div className="min-h-svh bg-[#F5F5F3]">
      {/* Desktop left sidebar */}
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-60 flex-col border-r border-[#E5E5E5] bg-white md:flex">
        <div className="px-6 pt-8 pb-6">
          <p className="text-xl font-bold tracking-tight text-black">HARP</p>
          <p className="mt-0.5 text-xs text-[#6B6B6B]">HackUTD 2026</p>
        </div>
        <nav className="flex flex-1 flex-col gap-1 px-3">
          {NAV_ITEMS.map(({ label, to, icon: Icon, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              className={({ isActive }) =>
                cn(
                  "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
                  isActive
                    ? "bg-black text-white"
                    : "text-[#6B6B6B] hover:bg-[#F5F5F3] hover:text-black",
                )
              }
            >
              <Icon className="size-4.5" strokeWidth={1.75} />
              {label}
            </NavLink>
          ))}
        </nav>
        <div className="px-3 pb-6">
          <button
            onClick={handleLogout}
            className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-[#6B6B6B] transition-colors hover:bg-[#F5F5F3] hover:text-black"
          >
            <LogOut className="size-4.5" strokeWidth={1.75} />
            Sign out
          </button>
        </div>
      </aside>

      {/* Page content */}
      <main className="pb-28 md:pb-0 md:pl-60">
        <Outlet />
      </main>

      {/* Mobile bottom tab bar */}
      <nav
        className="fixed inset-x-4 bottom-4 z-40 flex items-center justify-between rounded-2xl bg-[#3A3A38] px-3 py-2 md:hidden"
        style={{ paddingBottom: "max(0.5rem, env(safe-area-inset-bottom))" }}
      >
        {NAV_ITEMS.map(({ label, to, icon: Icon, end }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            className={({ isActive }) =>
              cn(
                "flex min-w-14 flex-col items-center gap-1 rounded-xl px-2 py-1.5 transition-colors active:scale-[0.98]",
                isActive ? "text-white" : "text-white/45",
              )
            }
          >
            <Icon className="size-5" strokeWidth={1.75} />
            <span className="text-[10px] font-medium">{label}</span>
          </NavLink>
        ))}
      </nav>
    </div>
  );
}
