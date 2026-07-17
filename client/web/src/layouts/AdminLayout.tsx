import { ChevronLeft } from "lucide-react";
import { Outlet, useNavigate } from "react-router-dom";

import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { AppSidebar } from "@/pages/admin/_shared";

export default function AdminLayout() {
  const navigate = useNavigate();

  return (
    <SidebarProvider className="h-svh min-h-0!">
      <AppSidebar />
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
            className="-ml-2 flex size-9 items-center justify-center rounded-full text-black transition-colors hover:bg-[#F0F0F0]"
          >
            <ChevronLeft className="size-5" strokeWidth={1.75} />
          </button>
        </header>
        <div className="flex flex-1 flex-col p-4 min-h-0 min-w-0">
          <Outlet />
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}
