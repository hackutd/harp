import { Outlet } from "react-router-dom";

import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { AppSidebar } from "@/pages/admin/_shared";

export default function AdminLayout() {
  return (
    <SidebarProvider className="h-svh min-h-0!">
      <AppSidebar />
      <SidebarInset className="overflow-hidden">
        <div className="flex flex-1 flex-col p-4 min-h-0 min-w-0">
          <Outlet />
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}
