import type { AuthorizationPermission } from "./authorization.ts";

type AdministrationNavigationItem = Readonly<{
  href: string;
  id: "roles" | "users";
  label: string;
  permissionKeys: readonly AuthorizationPermission[];
}>;

const administrationNavigation = [
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

export function getVisibleAdministrationNavigation(
  permissions: readonly AuthorizationPermission[],
): readonly AdministrationNavigationItem[] {
  return administrationNavigation.filter(({ permissionKeys }) =>
    permissionKeys.some((permission) => permissions.includes(permission)),
  );
}
