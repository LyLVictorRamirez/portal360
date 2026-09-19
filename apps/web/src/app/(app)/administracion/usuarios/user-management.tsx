"use client";

import { useEffect, useState } from "react";

import { UserRoleAssignmentDialog } from "./user-role-assignment-dialog";
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
import { TextField } from "../../../../components/ui/text-field";
import {
  listAuthorizationUsers,
  type AuthorizationManagedUser,
} from "../../../../lib/authorization-users-client";

type UserListState =
  | Readonly<{ kind: "loading" }>
  | Readonly<{ kind: "ready"; users: AuthorizationManagedUser[] }>
  | Readonly<{ kind: "unauthorized" }>
  | Readonly<{ kind: "error"; message: string }>;

type UserManagementProps = Readonly<{
  canManageUsers: boolean;
}>;

export function UserManagement({ canManageUsers }: UserManagementProps) {
  const [query, setQuery] = useState("");
  const [reloadKey, setReloadKey] = useState(0);
  const [selectedUser, setSelectedUser] = useState<AuthorizationManagedUser | null>(null);
  const [state, setState] = useState<UserListState>({ kind: "loading" });
  const [updateMessage, setUpdateMessage] = useState<string | null>(null);

  useEffect(() => {
    let current = true;
    const timeout = window.setTimeout(async () => {
      setState({ kind: "loading" });
      const result = await listAuthorizationUsers(query);

      if (!current) {
        return;
      }

      if (result.kind === "success") {
        setState({ kind: "ready", users: result.data });
        return;
      }

      setState(result);
    }, 200);

    return () => {
      current = false;
      window.clearTimeout(timeout);
    };
  }, [query, reloadKey]);

  function retry() {
    setReloadKey((value) => value + 1);
  }

  function handleRolesUpdated(userId: string, roles: AuthorizationManagedUser["roles"]) {
    setState((current) => {
      if (current.kind !== "ready") {
        return current;
      }

      const updatedUser = current.users.find((user) => user.id === userId);
      const name = updatedUser?.name ?? "La persona";
      setUpdateMessage(
        `${name} ahora tiene ${roles.length} ${roles.length === 1 ? "rol" : "roles"}.`,
      );

      return {
        kind: "ready",
        users: current.users.map((user) => (user.id === userId ? { ...user, roles } : user)),
      };
    });
  }

  const columns: DataTableColumn<AuthorizationManagedUser>[] = [
    {
      cell: (user) => <span className="font-semibold text-foreground">{user.name}</span>,
      header: "Persona",
      id: "name",
    },
    {
      cell: (user) => <span className="text-muted">{user.email}</span>,
      header: "Correo",
      id: "email",
    },
    {
      cell: (user) => (
        <StatusBadge
          label={user.emailVerified ? "Verificado" : "Pendiente"}
          tone={user.emailVerified ? "success" : "warning"}
        />
      ),
      header: "Verificación",
      id: "verification",
    },
    {
      cell: (user) =>
        user.roles.length > 0 ? (
          <ul aria-label={`Roles de ${user.name}`} className="flex flex-wrap gap-1.5">
            {user.roles.map((role) => (
              <li key={role.key}>
                <StatusBadge label={role.name} tone={role.isActive ? "info" : "neutral"} />
              </li>
            ))}
          </ul>
        ) : (
          <span className="text-muted">Sin roles asignados</span>
        ),
      header: "Roles",
      id: "roles",
    },
    ...(canManageUsers
      ? [
          {
            align: "right" as const,
            cell: (user: AuthorizationManagedUser) => (
              <Button onClick={() => setSelectedUser(user)} size="sm" variant="secondary">
                Administrar roles
              </Button>
            ),
            header: "Acciones",
            id: "actions",
          },
        ]
      : []),
  ];

  return (
    <div className="mx-auto w-full max-w-6xl space-y-8">
      <PageHeader
        description="Consulta el acceso de cada persona y prepara sus roles, incluso antes de que verifique el correo."
        title="Usuarios"
      />

      <section aria-labelledby="user-search-title" className="space-y-4">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2
              className="text-xl font-semibold tracking-tight text-foreground"
              id="user-search-title"
            >
              Directorio de acceso
            </h2>
            <p className="mt-1.5 max-w-2xl text-sm leading-6 text-muted">
              Busca por nombre o correo. Los cambios de roles se aplican al momento.
            </p>
          </div>
          {updateMessage ? (
            <p aria-live="polite" className="text-sm font-medium text-success">
              {updateMessage}
            </p>
          ) : null}
        </div>

        <TextField
          autoComplete="off"
          label="Buscar personas"
          onChange={(event) => {
            setQuery(event.target.value);
            setUpdateMessage(null);
          }}
          placeholder="Nombre o correo"
          type="search"
          value={query}
        />
      </section>

      {state.kind === "loading" ? <LoadingState title="Consultando usuarios" /> : null}
      {state.kind === "unauthorized" ? <UnauthorizedState /> : null}
      {state.kind === "error" ? (
        <ErrorState
          action={<Button onClick={retry}>Reintentar</Button>}
          description={state.message}
          title="No fue posible consultar usuarios"
        />
      ) : null}
      {state.kind === "ready" && state.users.length === 0 ? (
        <EmptyState
          description={
            query.trim()
              ? "No hay personas que coincidan con la búsqueda."
              : "Aún no hay personas registradas para administrar."
          }
          title="No encontramos usuarios"
        />
      ) : null}
      {state.kind === "ready" && state.users.length > 0 ? (
        <DataTable columns={columns} label="Usuarios y roles asignados" rows={state.users} />
      ) : null}

      {canManageUsers && selectedUser ? (
        <UserRoleAssignmentDialog
          onOpenChange={(open) => {
            if (!open) {
              setSelectedUser(null);
            }
          }}
          onRolesUpdated={handleRolesUpdated}
          open={selectedUser !== null}
          user={selectedUser}
        />
      ) : null}
    </div>
  );
}
