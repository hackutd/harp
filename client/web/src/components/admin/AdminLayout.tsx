import { Outlet, useLocation } from 'react-router-dom';
import { AppSidebar } from '@/components/admin/app-sidebar';
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

const routeNames: Record<string, string> = {
  '/admin/applications': 'All Applicants',
  '/admin/scans': 'Scanner',
  '/admin/settings': 'Settings',
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
            <SidebarTrigger className="-ml-1" />
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
