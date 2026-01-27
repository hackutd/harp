"use client"

import * as React from "react"
import {
  Users,
  UserCheck,
  CircleCheck,
  Package,
  UsersRound,
  HelpCircle,
  ScanLine,
  Settings,
} from "lucide-react"
import { useLocation, Link } from "react-router-dom"
import { NavSection } from '@/components/admin/nav-section'
import { NavUser } from '@/components/admin/nav-user'
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarRail,
} from '@/components/ui/sidebar'
import { Separator } from '@/components/ui/separator'
import { useUserStore } from '@/store'
import { useSidebar } from '@/components/ui/sidebar'

const applicantsNav = [
  {
    name: "All Applicants",
    url: "/admin/applications",
    icon: Users,
  },
  {
    name: "Assigned",
    url: "/admin/assigned",
    icon: UserCheck,
  },
  {
    name: "Completed",
    url: "/admin/completed",
    icon: CircleCheck,
  },
]

const eventNav = [
  {
    name: "Scans",
    url: "/admin/scans",
    icon: ScanLine,
  },
  {
    name: "Hacker Pack",
    url: "/admin/hacker-pack",
    icon: Package,
  },
  {
    name: "Groups",
    url: "/admin/groups",
    icon: UsersRound,
  },
  {
    name: "Questions",
    url: "/admin/questions",
    icon: HelpCircle,
  },
]

export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
  const { user } = useUserStore()
  const location = useLocation()
  const { state } = useSidebar()

  const userData = {
    name: user?.role
      ? user.role.replace('_', ' ').replace(/\b\w/g, (c) => c.toUpperCase())
      : 'Admin',
    email: user?.email || '',
    avatar: user?.profilePictureUrl || '',
  }

  return (
    <Sidebar collapsible="icon" {...props}>
      <SidebarHeader>
        <NavUser user={userData} />
      </SidebarHeader>
      <SidebarContent>
        <NavSection label="Applicants" items={applicantsNav} currentPath={location.pathname} />
        <NavSection label="Event" items={eventNav} currentPath={location.pathname} />
      </SidebarContent>
      <SidebarFooter>
        <Separator />
        <Link
          to="/admin/settings"
          className="flex items-center justify-between px-2 py-2 hover:bg-sidebar-accent rounded-md transition-colors"
        >
          {state === "expanded" && (
            <div className="flex flex-col">
              <span className="font-semibold text-sm">Settings</span>
              <span className="text-xs text-muted-foreground">Super Admins ONLY</span>
            </div>
          )}
          <Settings className="size-5" />
        </Link>
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  )
}
