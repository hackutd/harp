import { Outlet, useLocation } from 'react-router-dom';

import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '@/components/ui/breadcrumb';
import { Separator } from '@/components/ui/separator';
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from '@/components/ui/sidebar';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { AppSidebar } from '@/pages/admin/_shared';

const routeNames: Record<string, string> = {
  '/admin/applications': 'All Applicants',
  '/admin/assigned': 'Assigned',
  '/admin/completed': 'Completed',
  '/admin/scans': 'Scans',
  '/admin/hacker-pack': 'Hacker Pack',
  '/admin/groups': 'Groups',
};

export default function AdminLayout() {
  const location = useLocation();

  // Check if we're on an application detail page
  const isApplicationDetail = location.pathname.match(/^\/admin\/applications\/[^/]+$/);

  const getBreadcrumbs = () => {
    if (isApplicationDetail) {
      return (
        <>
          <BreadcrumbItem>
            <BreadcrumbLink href="/admin/applications">All Applicants</BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbPage>Application Details</BreadcrumbPage>
          </BreadcrumbItem>
        </>
      );
    }

    const pageName = routeNames[location.pathname] || 'Admin';
    return (
      <BreadcrumbItem>
        <BreadcrumbPage>{pageName}</BreadcrumbPage>
      </BreadcrumbItem>
    );
  };

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
                {getBreadcrumbs()}
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
