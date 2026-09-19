import type { AuthorizationPermission } from "./authorization.ts";

type AdministrationNavigationItem = Readonly<{
  href: string;
  id: "code-settings" | "roles" | "users";
  label: string;
  permissionKeys: readonly AuthorizationPermission[];
}>;

type BusinessNavigationItem = Readonly<{
  href: "/clientes" | "/proyectos";
  id: "clients" | "projects";
  label: "Clientes" | "Proyectos";
  permissionKeys: readonly AuthorizationPermission[];
}>;

const administrationNavigation = [
  {
    href: "/administracion/configuracion/codigos",
    id: "code-settings",
    label: "Códigos",
    permissionKeys: ["clients.settings.manage", "projects.settings.manage"],
  },
  {
    href: "/administracion/usuarios",
    id: "users",
    label: "Usuarios",
    permissionKeys: ["authorization.users.read", "authorization.users.manage"],
  },
  {
    href: "/administracion/roles",
    id: "roles",
    label: "Roles y permisos",
    permissionKeys: ["authorization.roles.read", "authorization.roles.manage"],
  },
] as const satisfies readonly AdministrationNavigationItem[];

const businessNavigation = [
  {
    href: "/clientes",
    id: "clients",
    label: "Clientes",
    permissionKeys: ["clients.read"],
  },
  {
    href: "/proyectos",
    id: "projects",
    label: "Proyectos",
    permissionKeys: ["projects.read"],
  },
] as const satisfies readonly BusinessNavigationItem[];

export function getVisibleAdministrationNavigation(
  permissions: readonly AuthorizationPermission[],
): readonly AdministrationNavigationItem[] {
  return administrationNavigation.filter(({ permissionKeys }) =>
    permissionKeys.some((permission) => permissions.includes(permission)),
  );
}

export function getVisibleBusinessNavigation(
  permissions: readonly AuthorizationPermission[],
): readonly BusinessNavigationItem[] {
  return businessNavigation.filter(({ permissionKeys }) =>
    permissionKeys.some((permission) => permissions.includes(permission)),
  );
}
