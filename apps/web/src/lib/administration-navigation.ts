import type { AuthorizationPermission } from "./authorization.ts";

type AdministrationNavigationItem = Readonly<{
  href: string;
  id: "activity-categories" | "code-settings" | "roles" | "users";
  label: string;
  permissionKeys: readonly AuthorizationPermission[];
}>;

type BusinessNavigationItem = Readonly<{
  href: "/actividades" | "/clientes" | "/proyectos" | "/requerimientos" | "/tickets";
  id: "activities" | "clients" | "projects" | "requirements" | "tickets";
  label: "Actividades" | "Clientes" | "Proyectos" | "Requerimientos" | "Tickets";
  permissionKeys: readonly AuthorizationPermission[];
}>;

const administrationNavigation = [
  {
    href: "/administracion/configuracion/codigos",
    id: "code-settings",
    label: "Códigos",
    permissionKeys: [
      "clients.settings.manage",
      "projects.settings.manage",
      "requirements.settings.manage",
    ],
  },
  {
    href: "/administracion/categorias-actividad",
    id: "activity-categories",
    label: "Categorías de actividad",
    permissionKeys: ["activity-categories.manage"],
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
  {
    href: "/requerimientos",
    id: "requirements",
    label: "Requerimientos",
    permissionKeys: ["requirements.read"],
  },
  {
    href: "/tickets",
    id: "tickets",
    label: "Tickets",
    permissionKeys: ["tickets.read"],
  },
  {
    href: "/actividades",
    id: "activities",
    label: "Actividades",
    permissionKeys: ["activities.read"],
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
