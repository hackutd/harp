"use client";

import {
  Calendar,
  ClipboardList,
  Handshake,
  ScanLine,
  Settings,
  Star,
  UserCheck,
  Users,
} from "lucide-react";
import * as React from "react";
import { useLocation } from "react-router-dom";

import { Separator } from "@/components/ui/separator";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarRail,
} from "@/components/ui/sidebar";
import { useSidebar } from "@/components/ui/sidebar";
import { SettingsDialog } from "@/pages/superadmin";
import { useUserStore } from "@/shared/stores";

import { NavSection } from "../_shared/NavSection";
import { NavUser } from "../_shared/NavUser";

const applicantsNav = [
  {
    name: "All Applicants",
    url: "/admin/all-applicants",
    icon: Users,
  },
  {
    name: "Reviews",
    url: "/admin/reviews",
    icon: UserCheck,
  },
];

const eventNav = [
  {
    name: "Scans",
    url: "/admin/scans",
    icon: ScanLine,
  },
  {
    name: "Schedule",
    url: "/admin/schedule",
    icon: Calendar,
  },
  {
    name: "Sponsors",
    url: "/admin/sponsors",
    icon: Handshake,
  },
];

const superAdminNav = [
  {
    name: "Reviews",
    url: "/admin/sa/reviews",
    icon: Star,
  },
  {
    name: "User Management",
    url: "/admin/sa/user-management",
    icon: Users,
  },
  {
    name: "Application",
    url: "/admin/sa/application",
    icon: ClipboardList,
  },
];

export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
  const { user } = useUserStore();
  const location = useLocation();
  const { state } = useSidebar();

  const userData = {
    name: user?.role
      ? user.role.replace("_", " ").replace(/\b\w/g, (c) => c.toUpperCase())
      : "Admin",
    email: user?.email || "",
    avatar: user?.profilePictureUrl || "",
  };

  return (
    <Sidebar collapsible="icon" {...props}>
      <SidebarHeader>
        <NavUser user={userData} />
      </SidebarHeader>
      <SidebarContent>
        <NavSection
          label="Applicants"
          items={applicantsNav}
          currentPath={location.pathname}
        />
        <NavSection
          label="Event"
          items={eventNav}
          currentPath={location.pathname}
        />

        {user?.role === "super_admin" && (
          <NavSection
            label="Super Admin"
            items={superAdminNav}
            currentPath={location.pathname}
          />
        )}
      </SidebarContent>
      <SidebarFooter>
        {user?.role === "super_admin" && (
          <>
            <Separator />
            <SettingsDialog
              trigger={
                <button className="flex cursor-pointer items-center justify-between px-2 py-2 hover:bg-sidebar-accent rounded-md transition-colors w-full">
                  {state === "expanded" && (
                    <div className="flex flex-col text-left">
                      <span className="font-semibold text-sm">Settings</span>
                      <span className="text-xs text-muted-foreground">
                        Super Admins ONLY
                      </span>
                    </div>
                  )}
                  <Settings className="size-5" />
                </button>
              }
            />
          </>
        )}
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  );
}
