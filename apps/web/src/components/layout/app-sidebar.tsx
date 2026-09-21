"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";

import {
  getVisibleAdministrationNavigation,
  getVisibleBusinessNavigation,
} from "../../lib/administration-navigation";
import { authClient } from "../../lib/auth-client";
import type { AuthorizationPermission } from "../../lib/authorization";
import { Icons } from "../icons";
import { Avatar, AvatarFallback, AvatarImage } from "../ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "../ui/dropdown-menu";
import { Portal360Mark } from "../ui/portal-360-mark";
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
} from "../ui/sidebar";

type User = Readonly<{
  email: string;
  image: string | null;
  name: string;
}>;

type NavigationIcon = keyof Pick<
  typeof Icons,
  "dashboard" | "forms" | "kanban" | "lock" | "settings" | "teams" | "workspace"
>;

type NavigationItem = Readonly<{
  href: string;
  icon: NavigationIcon;
  label: string;
}>;

type AppSidebarProps = Readonly<{
  permissions: readonly AuthorizationPermission[];
  user: User;
}>;

const primaryNavigation: readonly NavigationItem[] = [
  { href: "/", icon: "dashboard", label: "Inicio" },
];

const administrationNavigationIcons = {
  "code-settings": "settings",
  roles: "lock",
  users: "teams",
} as const satisfies Record<string, NavigationIcon>;

const businessNavigationIcons = {
  clients: "workspace",
  projects: "kanban",
  requirements: "forms",
} as const satisfies Record<string, NavigationIcon>;

function isCurrentRoute(pathname: string, href: string) {
  return href === "/" ? pathname === href : pathname === href || pathname.startsWith(`${href}/`);
}

function NavigationLink({
  item,
  onNavigate,
}: Readonly<{ item: NavigationItem; onNavigate: () => void }>) {
  const pathname = usePathname();
  const isActive = isCurrentRoute(pathname, item.href);
  const Icon = Icons[item.icon];

  return (
    <SidebarMenuItem>
      <SidebarMenuButton asChild isActive={isActive} tooltip={item.label}>
        <Link aria-current={isActive ? "page" : undefined} href={item.href} onClick={onNavigate}>
          <Icon />
          <span>{item.label}</span>
        </Link>
      </SidebarMenuButton>
    </SidebarMenuItem>
  );
}

function PortalIdentity() {
  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <SidebarMenuButton
          aria-label="Portal 360"
          className="pointer-events-none data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground"
          size="lg"
        >
          <span className="bg-sidebar-primary text-sidebar-primary-foreground flex aspect-square size-8 shrink-0 items-center justify-center rounded-lg">
            <Portal360Mark compact size="sm" />
          </span>
          <span className="grid flex-1 text-left text-sm leading-tight">
            <span className="truncate font-medium">Portal 360</span>
            <span className="text-muted-foreground truncate text-xs">Espacio de trabajo</span>
          </span>
        </SidebarMenuButton>
      </SidebarMenuItem>
    </SidebarMenu>
  );
}

function UserNavigation({ initialUser }: Readonly<{ initialUser: User }>) {
  const router = useRouter();
  const { data: session, isPending } = authClient.useSession();
  const [isSigningOut, setIsSigningOut] = useState(false);
  const [signOutError, setSignOutError] = useState<string | null>(null);
  const user = session?.user
    ? {
        email: session.user.email || initialUser.email,
        image: session.user.image ?? initialUser.image,
        name: session.user.name || initialUser.name,
      }
    : initialUser;

  async function handleSignOut() {
    setIsSigningOut(true);
    setSignOutError(null);

    try {
      const result = await authClient.signOut();

      if (result.error) {
        setSignOutError("No fue posible cerrar la sesión. Inténtalo de nuevo.");
        return;
      }

      router.replace("/login");
      router.refresh();
    } catch {
      setSignOutError("No fue posible cerrar la sesión. Inténtalo de nuevo.");
    } finally {
      setIsSigningOut(false);
    }
  }

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <p aria-live="polite" className="sr-only">
          {signOutError}
        </p>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <SidebarMenuButton
              className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground"
              size="lg"
            >
              <Avatar className="size-8 rounded-lg">
                {user.image ? <AvatarImage alt="" src={user.image} /> : null}
                <AvatarFallback className="rounded-lg text-xs font-medium">
                  {getInitials(user.name)}
                </AvatarFallback>
              </Avatar>
              <span className="grid flex-1 text-left text-sm leading-tight">
                <span className="truncate font-medium">{user.name}</span>
                <span className="text-muted-foreground truncate text-xs">{user.email}</span>
              </span>
              <Icons.chevronsDown className="ml-auto size-4" />
            </SidebarMenuButton>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            align="end"
            className="w-(--radix-dropdown-menu-trigger-width) min-w-56 rounded-lg"
            side="bottom"
            sideOffset={4}
          >
            <DropdownMenuLabel className="p-0 font-normal">
              <div className="flex items-center gap-3 px-2 py-2">
                <Avatar className="size-9 rounded-lg">
                  {user.image ? <AvatarImage alt="" src={user.image} /> : null}
                  <AvatarFallback className="rounded-lg text-xs font-medium">
                    {getInitials(user.name)}
                  </AvatarFallback>
                </Avatar>
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{user.name}</p>
                  <p className="text-muted-foreground truncate text-xs">{user.email}</p>
                </div>
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              disabled={isPending || isSigningOut}
              onSelect={() => void handleSignOut()}
            >
              <Icons.logout />
              {isSigningOut ? "Cerrando sesión…" : "Cerrar sesión"}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarMenuItem>
    </SidebarMenu>
  );
}

export function AppSidebar({ permissions, user }: AppSidebarProps) {
  const { isMobile, setOpenMobile } = useSidebar();
  const visibleAdministrationNavigation = getVisibleAdministrationNavigation(permissions);
  const visibleBusinessNavigation = getVisibleBusinessNavigation(permissions);
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

  function closeMobileNavigation() {
    if (isMobile) {
      setOpenMobile(false);
    }
  }

  return (
    <Sidebar aria-label="Navegación principal" collapsible="icon">
      <SidebarHeader className="group-data-[collapsible=icon]:pt-4">
        <PortalIdentity />
      </SidebarHeader>
      <SidebarContent className="overflow-x-hidden">
        <SidebarGroup className="py-0">
          <SidebarMenu>
            {primaryNavigation.map((item) => (
              <NavigationLink item={item} key={item.href} onNavigate={closeMobileNavigation} />
            ))}
            {businessNavigation.map((item) => (
              <NavigationLink item={item} key={item.href} onNavigate={closeMobileNavigation} />
            ))}
          </SidebarMenu>
        </SidebarGroup>
        {administrationNavigation.length > 0 ? (
          <SidebarGroup className="py-0">
            <SidebarGroupLabel>Administración</SidebarGroupLabel>
            <SidebarMenu>
              {administrationNavigation.map((item) => (
                <NavigationLink item={item} key={item.href} onNavigate={closeMobileNavigation} />
              ))}
            </SidebarMenu>
          </SidebarGroup>
        ) : null}
      </SidebarContent>
      <SidebarFooter>
        <UserNavigation initialUser={user} />
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  );
}

function getInitials(name: string): string {
  const initials = name
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");

  return initials || "U";
}
