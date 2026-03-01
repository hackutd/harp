import { Outlet, useLocation } from "react-router-dom";

import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbList,
  BreadcrumbPage,
} from "@/components/ui/breadcrumb";
import { Separator } from "@/components/ui/separator";
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { AppSidebar } from "@/pages/admin/_shared";

const routeNames: Record<string, string> = {
  "/admin/all-applicants": "All Applicants",
  "/admin/assigned": "Assigned",
  "/admin/completed": "Completed",
  "/admin/scans": "Scans",
  "/admin/schedule": "Schedule",
  "/admin/faqs": "FAQs",
  "/admin/sa/applications": "Applications",
  "/admin/sa/reviews": "Reviews",
  "/admin/sa/scans": "Scans",
  "/admin/sa/emails": "Emails",
};

export default function AdminLayout() {
  const location = useLocation();
  const pageName = routeNames[location.pathname] || "Admin";

  return (
    <SidebarProvider>
      <AppSidebar />
      <SidebarInset>
        <header className="flex h-16 shrink-0 items-center gap-2 transition-[width,height] ease-linear group-has-data-[collapsible=icon]/sidebar-wrapper:h-12">
          <div className="flex items-center gap-2 px-4">
            <Tooltip>
              <TooltipTrigger asChild>
                <SidebarTrigger className="-ml-1 cursor-pointer" />
              </TooltipTrigger>
              <TooltipContent side="right">Toggle sidebar (⌘B)</TooltipContent>
            </Tooltip>
            <Separator
              orientation="vertical"
              className="mr-2 data-[orientation=vertical]:h-4"
            />
            <Breadcrumb>
              <BreadcrumbList>
                <BreadcrumbItem>
                  <BreadcrumbPage>{pageName}</BreadcrumbPage>
                </BreadcrumbItem>
              </BreadcrumbList>
            </Breadcrumb>
          </div>
        </header>
        <div className="flex flex-1 flex-col p-4 pt-0 min-w-0 overflow-hidden">
          <Outlet />
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}
