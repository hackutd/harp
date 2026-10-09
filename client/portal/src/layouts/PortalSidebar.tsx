import {
  IconArrowUpRight,
  IconCheck,
  IconChevronDown,
  IconEye,
  IconLayoutDashboard,
  IconLayoutSidebarLeftCollapse,
  IconLayoutSidebarLeftExpand,
  IconLogout,
  IconMoon,
  IconSelector,
  IconSettings,
  IconShieldCheck,
  IconSun,
  IconUser,
  type TablerIcon,
} from "@tabler/icons-react";
import { Link, useLocation, useNavigate } from "react-router";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Kbd } from "@/components/ui/kbd";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
  useSidebar,
} from "@/components/ui/sidebar";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { signOutExplicitly } from "@/shared/auth";
import { cn } from "@/shared/lib/utils";
import { ZERODAY_LOGO, ZERODAY_URL } from "@/shared/lib/zeroday";
import {
  useAttendeeStore,
  useSettingsDialogStore,
  useUserStore,
} from "@/shared/stores";
import type { Theme, UserRole } from "@/types";

export interface SidebarNavItem {
  label: string;
  to: string;
  icon: TablerIcon;
  /** Filled variant swapped in while the item is selected. */
  activeIcon?: TablerIcon;
  /** When true, only the exact path is active (not nested child routes). */
  end: boolean;
}

/** An account-menu entry that runs an action (e.g. opens a dialog). */
export interface SidebarMenuAction {
  label: string;
  icon: TablerIcon;
  onSelect: () => void;
}

export interface SidebarNavSection {
  /** Group heading; omit for a single unlabelled list. */
  label?: string;
  items: SidebarNavItem[];
}

export type Portal = "hacker" | "admin";

interface PortalConfig {
  name: string;
  host: string;
  icon: TablerIcon;
  /** Where switching to this portal lands. */
  home: string;
  /** Where the account menu's view switch goes (admins only). */
  other: { label: string; to: string; icon: TablerIcon };
}

const PORTALS: Record<Portal, PortalConfig> = {
  hacker: {
    name: "Hacker portal",
    host: "harp.hackutd.co",
    icon: IconLayoutDashboard,
    home: "/app",
    other: { label: "Admin view", to: "/admin", icon: IconShieldCheck },
  },
  admin: {
    name: "Admin portal",
    host: "harp.hackutd.co/admin",
    icon: IconShieldCheck,
    home: "/admin",
    other: { label: "Hacker view", to: "/app", icon: IconEye },
  },
};

interface SidebarTone {
  /** Scopes the sidebar palette; `menu` is also set on the portaled menus. */
  sidebar: string;
  menu: string;
}

// Both portals share one markup; the tone classes in index.css repaint the
// ink/surface tokens to match the user's theme (dark, or light #F8F8F7).
const TONES: Record<Theme, SidebarTone> = {
  dark: { sidebar: "hacker-zero-sidebar", menu: "hacker-card-surfaces" },
  light: { sidebar: "admin-sidebar", menu: "admin-sidebar" },
};

// Shown in place of a name until the hacker has filled theirs in.
const ROLE_LABELS: Record<UserRole, string> = {
  hacker: "Hacker",
  admin: "Admin",
  super_admin: "Super admin",
};

// The sidebar's own handler (components/ui/sidebar.tsx) accepts either
// modifier; show the one this platform's users will reach for.
const TOGGLE_SHORTCUT =
  typeof navigator !== "undefined" &&
  /Mac|iP(hone|ad|od)/.test(navigator.userAgent)
    ? "⌘B"
    : "Ctrl+B";

function isAdminRole(role: UserRole | undefined): boolean {
  return role === "admin" || role === "super_admin";
}

/**
 * Navigates to another portal. Closes the mobile sheet first, then defers
 * navigation so Radix overlays can restore `document.body`'s pointer-events
 * before this layout unmounts.
 */
function useSwitchPortal() {
  const navigate = useNavigate();
  const { setOpenMobile } = useSidebar();
  return (to: string) => {
    setOpenMobile(false);
    requestAnimationFrame(() => navigate(to));
  };
}

function isActivePath(item: SidebarNavItem, pathname: string): boolean {
  return item.end
    ? pathname === item.to
    : pathname === item.to || pathname.startsWith(item.to + "/");
}

/** Close (expanded) or open (collapsed) button, with the shortcut on hover. */
function SidebarToggle() {
  const { state, toggleSidebar } = useSidebar();
  const collapsed = state === "collapsed";
  const label = collapsed ? "Open sidebar" : "Close sidebar";
  const Icon = collapsed
    ? IconLayoutSidebarLeftExpand
    : IconLayoutSidebarLeftCollapse;

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          onClick={toggleSidebar}
          aria-label={label}
          className="flex size-8 shrink-0 items-center justify-center rounded-md text-ink/65 transition-colors hover:bg-surface-2 hover:text-ink focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
        >
          <Icon className="size-[18px]" strokeWidth={1.5} />
        </button>
      </TooltipTrigger>
      <TooltipContent
        side={collapsed ? "right" : "bottom"}
        className="flex items-center gap-2"
      >
        {label}
        <Kbd className="!bg-ink/10 !text-ink/70">{TOGGLE_SHORTCUT}</Kbd>
      </TooltipContent>
    </Tooltip>
  );
}

/**
 * The header's product switcher: the portal you are in (checked), the other
 * portal for admins and super admins, and the Zero Day event site.
 */
function ZeroDaySwitcher({
  portal,
  tone,
}: {
  portal: Portal;
  tone: SidebarTone;
}) {
  const isAdmin = useUserStore((s) => isAdminRole(s.user?.role));
  const switchPortal = useSwitchPortal();
  const portals: Portal[] = isAdmin ? ["admin", "hacker"] : [portal];

  return (
    <DropdownMenu modal={false}>
      <DropdownMenuTrigger className="flex min-w-0 items-center gap-2 rounded-md px-1.5 py-1 text-left transition-colors outline-none hover:bg-surface-2 focus-visible:ring-2 focus-visible:ring-ring data-[state=open]:bg-surface-2">
        <img
          src={ZERODAY_LOGO}
          alt=""
          aria-hidden
          className="size-6 shrink-0 object-contain"
        />
        <span className="truncate text-[15px] font-normal text-ink">
          Zero Day
        </span>
        <IconChevronDown
          aria-hidden
          className="size-3.5 shrink-0 text-ink/55"
          strokeWidth={1.75}
        />
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="start"
        sideOffset={8}
        className={cn(tone.menu, "w-60 rounded-xl bg-surface p-1.5")}
      >
        {portals.map((p) => {
          const config = PORTALS[p];
          const current = p === portal;
          const PortalIcon = config.icon;
          return (
            <DropdownMenuItem
              key={p}
              onClick={current ? undefined : () => switchPortal(config.home)}
              className="items-center gap-2.5 rounded-lg focus:bg-surface-2"
            >
              <PortalIcon aria-hidden className="size-5" strokeWidth={1.5} />
              <span className="grid min-w-0 flex-1 leading-tight">
                <span className="text-[13px] text-ink">{config.name}</span>
                <span className="mt-1 text-xs text-ink/55">{config.host}</span>
              </span>
              {current && (
                <IconCheck
                  aria-label="Current portal"
                  className="ml-auto size-4 text-ink"
                  strokeWidth={1.5}
                />
              )}
            </DropdownMenuItem>
          );
        })}
        <DropdownMenuSeparator />
        <DropdownMenuItem
          asChild
          className="items-center gap-2.5 rounded-lg focus:bg-surface-2"
        >
          <a href={ZERODAY_URL} target="_blank" rel="noopener noreferrer">
            <img
              src={ZERODAY_LOGO}
              alt=""
              aria-hidden
              className="size-6 shrink-0 object-contain"
            />
            <span className="grid min-w-0 flex-1 leading-tight">
              <span className="text-[13px] text-ink">Back to Zero Day</span>
              <span className="mt-1 text-xs text-ink/55">
                zeroday.hackutd.co
              </span>
            </span>
            <IconArrowUpRight
              aria-hidden
              className="ml-auto size-4 text-ink/65"
              strokeWidth={1.5}
            />
          </a>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/**
 * The footer account menu: avatar, name (or role), and email, opening onto
 * Settings, the light/dark switch, any portal actions (e.g. Hackathon
 * Settings), the other portal (for admins), Zero Day, and log out.
 */
function AccountMenu({
  config,
  tone,
  theme,
  actions,
}: {
  config: PortalConfig;
  tone: SidebarTone;
  theme: Theme;
  actions: SidebarMenuAction[];
}) {
  const navigate = useNavigate();
  const switchPortal = useSwitchPortal();
  const user = useUserStore((s) => s.user);
  const clearUser = useUserStore((s) => s.clearUser);
  const updateTheme = useUserStore((s) => s.updateTheme);
  const openSettings = useSettingsDialogStore((s) => s.setOpen);
  const name = useAttendeeStore((s) => (s.userId === user?.id ? s.name : null));

  const label = name ?? (user ? ROLE_LABELS[user.role] : "Hacker");
  const isAdmin = isAdminRole(user?.role);
  const OtherIcon = config.other.icon;
  const nextTheme: Theme = theme === "dark" ? "light" : "dark";
  const ThemeIcon = nextTheme === "light" ? IconSun : IconMoon;

  const avatar = (
    <Avatar className="size-8 rounded-full">
      <AvatarImage src={user?.profilePictureUrl || undefined} alt="" />
      <AvatarFallback className="rounded-full bg-surface-2">
        <IconUser aria-hidden className="size-4" strokeWidth={1.5} />
      </AvatarFallback>
    </Avatar>
  );
  const identity = (
    <span className="grid flex-1 text-left leading-tight">
      <span className="truncate text-sm text-ink">{label}</span>
      <span className="truncate text-xs text-ink/55">{user?.email}</span>
    </span>
  );

  const handleLogout = async () => {
    await signOutExplicitly();
    clearUser();
    navigate("/");
  };

  return (
    <DropdownMenu modal={false}>
      <DropdownMenuTrigger asChild>
        <SidebarMenuButton
          size="lg"
          aria-label={`Account menu for ${label}`}
          className="data-[state=open]:bg-sidebar-accent"
        >
          {avatar}
          {identity}
          <IconSelector
            aria-hidden
            className="ml-auto size-4 text-ink/55"
            strokeWidth={1.5}
          />
        </SidebarMenuButton>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        side="top"
        align="start"
        sideOffset={8}
        className={cn(
          tone.menu,
          "w-(--radix-dropdown-menu-trigger-width) min-w-56 rounded-xl bg-surface p-1.5",
        )}
      >
        <DropdownMenuLabel className="flex items-center gap-2 px-2 py-1.5 font-normal">
          {avatar}
          {identity}
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          // Let the menu close and hand back focus before the dialog opens
          // and traps it.
          onClick={() => requestAnimationFrame(() => openSettings(true))}
          className="gap-2 rounded-lg focus:bg-surface-2"
        >
          <IconSettings aria-hidden strokeWidth={1.5} />
          Settings
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={() => void updateTheme(nextTheme)}
          className="gap-2 rounded-lg focus:bg-surface-2"
        >
          <ThemeIcon aria-hidden strokeWidth={1.5} />
          {nextTheme === "light" ? "Light mode" : "Dark mode"}
        </DropdownMenuItem>
        {actions.map((action) => {
          const Icon = action.icon;
          return (
            <DropdownMenuItem
              key={action.label}
              // Let the menu close and hand back focus before a dialog opens
              // and traps it.
              onClick={() => requestAnimationFrame(action.onSelect)}
              className="gap-2 rounded-lg focus:bg-surface-2"
            >
              <Icon aria-hidden strokeWidth={1.5} />
              {action.label}
            </DropdownMenuItem>
          );
        })}
        {isAdmin && (
          <DropdownMenuItem
            onClick={() => switchPortal(config.other.to)}
            className="gap-2 rounded-lg focus:bg-surface-2"
          >
            <OtherIcon aria-hidden strokeWidth={1.5} />
            {config.other.label}
          </DropdownMenuItem>
        )}
        <DropdownMenuItem
          asChild
          className="gap-2 rounded-lg focus:bg-surface-2"
        >
          <a href={ZERODAY_URL} target="_blank" rel="noopener noreferrer">
            <img
              src={ZERODAY_LOGO}
              alt=""
              aria-hidden
              className="size-4 shrink-0 object-contain"
            />
            Back to Zero Day
          </a>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onClick={handleLogout}
          className="gap-2 rounded-lg focus:bg-surface-2"
        >
          <IconLogout aria-hidden strokeWidth={1.5} />
          Log out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

// 18px icons; the collapsed rail trims its padding so they still fit the 32px
// button.
const MENU_BUTTON_CLASS =
  "group-data-[collapsible=icon]:p-[7px]! [&>svg]:size-[18px]";

function NavEntry({
  item,
  pathname,
}: {
  item: SidebarNavItem;
  pathname: string;
}) {
  const active = isActivePath(item, pathname);
  const Icon = active ? (item.activeIcon ?? item.icon) : item.icon;
  return (
    <SidebarMenuButton
      asChild
      isActive={active}
      tooltip={item.label}
      className={MENU_BUTTON_CLASS}
    >
      <Link to={item.to}>
        <Icon strokeWidth={1.5} />
        <span>{item.label}</span>
      </Link>
    </SidebarMenuButton>
  );
}

/**
 * Desktop sidebar shared by the hacker and admin portals. Collapses to an icon
 * rail that stays fully clickable (each icon gets a tooltip); ⌘B / Ctrl+B
 * toggles it. The Zero Day switcher sits top left and the account menu
 * (Settings, theme switch, `menuActions`, view switch, Zero Day, log out) at
 * the bottom.
 */
export function PortalSidebar({
  portal,
  theme,
  sections,
  menuActions = [],
}: {
  portal: Portal;
  theme: Theme;
  sections: SidebarNavSection[];
  menuActions?: SidebarMenuAction[];
}) {
  const { pathname } = useLocation();
  const config = PORTALS[portal];
  const tone = TONES[theme];

  return (
    <Sidebar
      collapsible="icon"
      className={cn(tone.sidebar, "hidden border-ink/10 md:flex")}
    >
      <SidebarHeader className="flex-row items-center justify-between gap-2 group-data-[collapsible=icon]:justify-center">
        <div className="min-w-0 group-data-[collapsible=icon]:hidden">
          <ZeroDaySwitcher portal={portal} tone={tone} />
        </div>
        <SidebarToggle />
      </SidebarHeader>

      <SidebarContent>
        {sections.map((section, i) => (
          <SidebarGroup key={section.label ?? i}>
            {section.label && (
              <SidebarGroupLabel>{section.label}</SidebarGroupLabel>
            )}
            <SidebarMenu>
              {section.items.map((item) => (
                <SidebarMenuItem key={item.to}>
                  <NavEntry item={item} pathname={pathname} />
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroup>
        ))}
      </SidebarContent>

      <SidebarFooter className="border-t border-ink/10">
        <SidebarMenu>
          <SidebarMenuItem>
            <AccountMenu
              config={config}
              tone={tone}
              theme={theme}
              actions={menuActions}
            />
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  );
}
