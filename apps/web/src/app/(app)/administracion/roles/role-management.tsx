"use client";

import { useEffect, useState } from "react";

import { DeleteRoleDialog } from "./delete-role-dialog";
import { RoleEditorDialog } from "./role-editor-dialog";
import { Button } from "../../../../components/ui/button";
import { DataTable, type DataTableColumn } from "../../../../components/ui/data-table";
import {
  EmptyState,
  ErrorState,
  LoadingState,
  UnauthorizedState,
} from "../../../../components/states/interface-states";
import { PageHeader } from "../../../../components/ui/page-header";
import { StatusBadge } from "../../../../components/ui/status-badge";
import { Surface } from "../../../../components/ui/surface";
import {
  listAuthorizationRoleCatalog,
  type AuthorizationRoleCatalog,
  type AuthorizationRoleDetails,
} from "../../../../lib/authorization-roles-client";

type RoleCatalogState =
  | Readonly<{ kind: "loading" }>
  | Readonly<{ catalog: AuthorizationRoleCatalog; kind: "ready" }>
  | Readonly<{ kind: "unauthorized" }>
  | Readonly<{ kind: "error"; message: string }>;

type RoleTableRow = AuthorizationRoleDetails & Readonly<{ id: string }>;

type RoleManagementProps = Readonly<{
  canManageRoles: boolean;
}>;

export function RoleManagement({ canManageRoles }: RoleManagementProps) {
  const [editorRole, setEditorRole] = useState<AuthorizationRoleDetails | null | undefined>(
    undefined,
  );
  const [roleToDelete, setRoleToDelete] = useState<AuthorizationRoleDetails | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [state, setState] = useState<RoleCatalogState>({ kind: "loading" });
  const [updateMessage, setUpdateMessage] = useState<string | null>(null);

  useEffect(() => {
    let current = true;
    setState({ kind: "loading" });

    void listAuthorizationRoleCatalog().then((result) => {
      if (!current) {
        return;
      }

      if (result.kind === "success") {
        setState({ catalog: result.data, kind: "ready" });
        return;
      }

      setState(result);
    });

    return () => {
      current = false;
    };
  }, [reloadKey]);

  function retry() {
    setReloadKey((value) => value + 1);
  }

  function handleRoleSaved(role: AuthorizationRoleDetails) {
    setState((current) => {
      if (current.kind !== "ready") {
        return current;
      }

      const previousRole = current.catalog.roles.find((item) => item.key === role.key);
      setUpdateMessage(
        previousRole
          ? `Se actualizaron los permisos de ${role.name}.`
          : `Se creó el rol ${role.name}.`,
      );

      const roles = previousRole
        ? current.catalog.roles.map((item) => (item.key === role.key ? role : item))
        : [...current.catalog.roles, role];

      return {
        catalog: {
          ...current.catalog,
          roles: [...roles].sort((first, second) => first.name.localeCompare(second.name, "es")),
        },
        kind: "ready",
      };
    });
  }

  function handleRoleDeleted(roleKey: string) {
    setState((current) => {
      if (current.kind !== "ready") {
        return current;
      }

      const role = current.catalog.roles.find((item) => item.key === roleKey);
      setUpdateMessage(role ? `Se eliminó el rol ${role.name}.` : "Se eliminó el rol.");

      return {
        catalog: {
          ...current.catalog,
          roles: current.catalog.roles.filter((item) => item.key !== roleKey),
        },
        kind: "ready",
      };
    });
  }

  const catalog = state.kind === "ready" ? state.catalog : null;
  const permissionNames = new Map(
    catalog?.permissions.map((permission) => [permission.key, permission.name]) ?? [],
  );
  const roleRows: RoleTableRow[] = catalog?.roles.map((role) => ({ ...role, id: role.key })) ?? [];
  const columns = createColumns(
    canManageRoles,
    permissionNames,
    (role) => {
      setEditorRole(role);
      setUpdateMessage(null);
    },
    (role) => {
      setRoleToDelete(role);
      setUpdateMessage(null);
    },
  );

  return (
    <div className="mx-auto w-full max-w-6xl space-y-8">
      <PageHeader
        actions={
          canManageRoles ? (
            <Button
              onClick={() => {
                setEditorRole(null);
                setUpdateMessage(null);
              }}
            >
              Crear rol
            </Button>
          ) : undefined
        }
        description="Define los permisos que se acumulan cuando una persona recibe uno o más roles."
        title="Roles y permisos"
      />

      <Surface aria-labelledby="system-role-rules-title" padding="md" tone="muted">
        <h2 className="text-base font-semibold text-foreground" id="system-role-rules-title">
          Reglas de los roles del sistema
        </h2>
        <ul className="mt-3 space-y-2 text-sm leading-6 text-muted">
          <li>Los roles del sistema se pueden ajustar, pero no eliminar ni desactivar.</li>
          <li>
            Estándar es el rol predeterminado y siempre conserva el permiso{" "}
            <code className="rounded bg-surface px-1.5 py-0.5 text-xs text-foreground">
              app.access
            </code>
            .
          </li>
          <li>
            El sistema valida que cada persona y la administración conserven acceso suficiente.
          </li>
        </ul>
      </Surface>

      <section aria-labelledby="role-catalog-title" className="space-y-4">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2
              className="text-xl font-semibold tracking-tight text-foreground"
              id="role-catalog-title"
            >
              Catálogo de roles
            </h2>
            <p className="mt-1.5 max-w-2xl text-sm leading-6 text-muted">
              Los permisos se muestran por rol; una asignación puede reunir varios roles activos.
            </p>
          </div>
          {updateMessage ? (
            <p aria-live="polite" className="text-sm font-medium text-success">
              {updateMessage}
            </p>
          ) : null}
        </div>

        {state.kind === "loading" ? <LoadingState title="Consultando roles" /> : null}
        {state.kind === "unauthorized" ? <UnauthorizedState /> : null}
        {state.kind === "error" ? (
          <ErrorState
            action={<Button onClick={retry}>Reintentar</Button>}
            description={state.message}
            title="No fue posible consultar los roles"
          />
        ) : null}
        {state.kind === "ready" && roleRows.length === 0 ? (
          <EmptyState
            description="Aún no hay roles disponibles para administrar."
            title="No encontramos roles"
          />
        ) : null}
        {state.kind === "ready" && roleRows.length > 0 ? (
          <DataTable columns={columns} label="Roles y permisos configurados" rows={roleRows} />
        ) : null}
      </section>

      {canManageRoles && catalog && editorRole !== undefined ? (
        <RoleEditorDialog
          onOpenChange={(open) => {
            if (!open) {
              setEditorRole(undefined);
            }
          }}
          onRoleSaved={handleRoleSaved}
          open={editorRole !== undefined}
          permissions={catalog.permissions}
          role={editorRole}
        />
      ) : null}
      {canManageRoles && roleToDelete ? (
        <DeleteRoleDialog
          onDeleted={handleRoleDeleted}
          onOpenChange={(open) => {
            if (!open) {
              setRoleToDelete(null);
            }
          }}
          open={roleToDelete !== null}
          role={roleToDelete}
        />
      ) : null}
    </div>
  );
}

function createColumns(
  canManageRoles: boolean,
  permissionNames: ReadonlyMap<string, string>,
  onEdit: (role: RoleTableRow) => void,
  onDelete: (role: RoleTableRow) => void,
): DataTableColumn<RoleTableRow>[] {
  return [
    {
      cell: (role) => (
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-semibold text-foreground">{role.name}</span>
            <StatusBadge label={role.kind === "system" ? "Sistema" : "Personalizado"} />
          </div>
          <p className="mt-1 text-muted">{role.description}</p>
          <code className="mt-1.5 inline-block text-xs text-muted">{role.key}</code>
        </div>
      ),
      header: "Rol",
      id: "role",
    },
    {
      cell: (role) => (
        <div className="flex flex-wrap gap-1.5">
          <StatusBadge
            label={role.isActive ? "Activo" : "Inactivo"}
            tone={role.isActive ? "success" : "neutral"}
          />
          {role.isDefault ? <StatusBadge label="Predeterminado" tone="info" /> : null}
        </div>
      ),
      header: "Estado",
      id: "status",
    },
    {
      cell: (role) =>
        role.permissions.length > 0 ? (
          <ul
            aria-label={`Permisos de ${role.name}`}
            className="space-y-1 text-xs leading-5 text-muted"
          >
            {role.permissions.map((permission) => (
              <li key={permission}>
                <span className="font-medium text-foreground">
                  {permissionNames.get(permission) ?? permission}
                </span>{" "}
                <code>{permission}</code>
              </li>
            ))}
          </ul>
        ) : (
          <span className="text-muted">Sin permisos</span>
        ),
      header: "Permisos",
      id: "permissions",
    },
    ...(canManageRoles
      ? [
          {
            align: "right" as const,
            cell: (role: RoleTableRow) => (
              <div className="flex justify-end gap-2">
                <Button onClick={() => onEdit(role)} size="sm" variant="secondary">
                  Editar
                </Button>
                {role.kind === "custom" ? (
                  <Button onClick={() => onDelete(role)} size="sm" variant="ghost">
                    Eliminar
                  </Button>
                ) : null}
              </div>
            ),
            header: "Acciones",
            id: "actions",
          },
        ]
      : []),
  ];
}
