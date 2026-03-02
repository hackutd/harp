import { PanelLeft } from "lucide-react";
import { Outlet } from "react-router-dom";

import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import { AppSidebar } from "@/pages/admin/_shared";

export default function AdminLayout() {
  return (
    <SidebarProvider className="h-svh min-h-0!">
      <AppSidebar />
      <SidebarInset className="overflow-hidden">
        <header className="flex items-center gap-2 border-b px-4 py-2 md:hidden">
          <SidebarTrigger>
            <PanelLeft />
          </SidebarTrigger>
        </header>
        <div className="flex flex-1 flex-col p-4 min-h-0 min-w-0">
          <Outlet />
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}
