import type { AuthorizationPermission } from "./authorization.ts";

type AdministrationNavigationItem = Readonly<{
  href: string;
  id: "client-code-settings" | "roles" | "users";
  label: string;
  permissionKeys: readonly AuthorizationPermission[];
}>;

type ClientNavigationItem = Readonly<{
  href: "/clientes";
  id: "clients";
  label: "Clientes";
  permissionKeys: readonly ["clients.read"];
}>;

const administrationNavigation = [
  {
    href: "/administracion/configuracion/clientes",
    id: "client-code-settings",
    label: "Códigos de Clientes",
    permissionKeys: ["clients.settings.manage"],
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

const clientNavigation = [
  {
    href: "/clientes",
    id: "clients",
    label: "Clientes",
    permissionKeys: ["clients.read"],
  },
] as const satisfies readonly ClientNavigationItem[];

export function getVisibleAdministrationNavigation(
  permissions: readonly AuthorizationPermission[],
): readonly AdministrationNavigationItem[] {
  return administrationNavigation.filter(({ permissionKeys }) =>
    permissionKeys.some((permission) => permissions.includes(permission)),
  );
}

export function getVisibleClientNavigation(
  permissions: readonly AuthorizationPermission[],
): readonly ClientNavigationItem[] {
  return clientNavigation.filter(({ permissionKeys }) =>
    permissionKeys.some((permission) => permissions.includes(permission)),
  );
}
