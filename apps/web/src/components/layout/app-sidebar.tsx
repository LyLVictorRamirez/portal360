"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Building2,
  FolderKanban,
  Home,
  Settings2,
  Shield,
  Users,
  X,
  type LucideIcon,
} from "lucide-react";

import {
  getVisibleAdministrationNavigation,
  getVisibleBusinessNavigation,
} from "../../lib/administration-navigation";
import type { AuthorizationPermission } from "../../lib/authorization";
import { Button } from "../ui/button";
import { Portal360Mark } from "../ui/portal-360-mark";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "../ui/sidebar";

const primaryNavigation = [{ href: "/", icon: Home, label: "Inicio" }];

const administrationNavigationIcons = {
  "code-settings": Settings2,
  roles: Shield,
  users: Users,
};

const businessNavigationIcons = {
  clients: Building2,
  projects: FolderKanban,
  requirements: FolderKanban,
};

type NavigationItem = Readonly<{
  href: string;
  icon: LucideIcon;
  label: string;
}>;

type AppSidebarProps = Readonly<{
  permissions: readonly AuthorizationPermission[];
}>;

function isCurrentRoute(pathname: string, href: string) {
  return href === "/" ? pathname === href : pathname === href || pathname.startsWith(`${href}/`);
}

function NavigationLink({
  item,
  onNavigate,
}: Readonly<{ item: NavigationItem; onNavigate: () => void }>) {
  const pathname = usePathname();
  const isActive = isCurrentRoute(pathname, item.href);
  const Icon = item.icon;

  return (
    <SidebarMenuItem>
      <SidebarMenuButton
        asChild
        className="h-11 rounded-r-md border-l-2 border-transparent px-4 text-sm data-[active=true]:border-primary data-[active=true]:bg-sidebar-accent"
        isActive={isActive}
        size="lg"
        tooltip={item.label}
      >
        <Link aria-current={isActive ? "page" : undefined} href={item.href} onClick={onNavigate}>
          <Icon aria-hidden="true" strokeWidth={1.75} />
          <span>{item.label}</span>
        </Link>
      </SidebarMenuButton>
    </SidebarMenuItem>
  );
}

export function AppSidebar({ permissions }: AppSidebarProps) {
  const { isMobile, openMobile, setOpenMobile, state } = useSidebar();
  const compact = !isMobile && state === "collapsed";
  const visibleAdministrationNavigation = getVisibleAdministrationNavigation(permissions);
  const visibleBusinessNavigation = getVisibleBusinessNavigation(permissions);

  function closeMobileNavigation() {
    if (isMobile) {
      setOpenMobile(false);
    }
  }

  const businessNavigation: NavigationItem[] = visibleBusinessNavigation.map((item) => ({
    ...item,
    icon: businessNavigationIcons[item.id],
  }));
  const administrationNavigation: NavigationItem[] = visibleAdministrationNavigation.map(
    (item) => ({
      ...item,
      icon: administrationNavigationIcons[item.id],
    }),
  );

  return (
    <Sidebar aria-label="Navegación principal" collapsible="icon">
      <SidebarHeader className="min-h-20 border-b border-sidebar-border p-0">
        <div className="flex min-h-20 items-center justify-between px-5 group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:px-3">
          <Link
            aria-label="Portal 360"
            className="inline-flex rounded-sm"
            href="/"
            onClick={closeMobileNavigation}
          >
            <Portal360Mark compact={compact} size="md" />
          </Link>
          {openMobile ? (
            <Button
              aria-label="Cerrar navegación"
              className="md:hidden"
              onClick={() => setOpenMobile(false)}
              size="icon"
              variant="ghost"
            >
              <X aria-hidden="true" />
            </Button>
          ) : null}
        </div>
      </SidebarHeader>
      <SidebarContent className="px-3 py-5">
        <SidebarGroup className="p-0">
          <SidebarMenu className="gap-1">
            {primaryNavigation.map((item) => (
              <NavigationLink item={item} key={item.href} onNavigate={closeMobileNavigation} />
            ))}
            {businessNavigation.map((item) => (
              <NavigationLink item={item} key={item.href} onNavigate={closeMobileNavigation} />
            ))}
          </SidebarMenu>
        </SidebarGroup>
        {administrationNavigation.length > 0 ? (
          <SidebarGroup className="mt-6 border-t border-sidebar-border pt-4 group-data-[collapsible=icon]:mt-2 group-data-[collapsible=icon]:border-t-0 group-data-[collapsible=icon]:pt-0">
            <SidebarGroupLabel className="px-4 pb-2 text-xs font-semibold tracking-normal text-muted group-data-[collapsible=icon]:sr-only">
              Administración
            </SidebarGroupLabel>
            <SidebarMenu className="gap-1">
              {administrationNavigation.map((item) => (
                <NavigationLink item={item} key={item.href} onNavigate={closeMobileNavigation} />
              ))}
            </SidebarMenu>
          </SidebarGroup>
        ) : null}
      </SidebarContent>
    </Sidebar>
  );
}
