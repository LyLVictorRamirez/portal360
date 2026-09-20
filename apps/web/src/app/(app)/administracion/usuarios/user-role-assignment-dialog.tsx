"use client";

import { useEffect, useState } from "react";

import { Button } from "../../../../components/ui/button";
import { Checkbox } from "../../../../components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "../../../../components/ui/dialog";
import {
  listAssignableAuthorizationRoles,
  replaceAuthorizationUserRoles,
  type AuthorizationApiResult,
  type AuthorizationManagedUser,
} from "../../../../lib/authorization-users-client";
import type { AuthorizationRole } from "../../../../lib/authorization";

type RoleCatalogState =
  | Readonly<{ kind: "loading" }>
  | Readonly<{ kind: "ready"; roles: AuthorizationRole[] }>
  | Readonly<{ kind: "unauthorized" }>
  | Readonly<{ kind: "error"; message: string }>;

type UserRoleAssignmentDialogProps = Readonly<{
  onOpenChange: (open: boolean) => void;
  onRolesUpdated: (userId: string, roles: AuthorizationRole[]) => void;
  open: boolean;
  user: AuthorizationManagedUser;
}>;

export function UserRoleAssignmentDialog({
  onOpenChange,
  onRolesUpdated,
  open,
  user,
}: UserRoleAssignmentDialogProps) {
  const [catalogState, setCatalogState] = useState<RoleCatalogState>({ kind: "loading" });
  const [selectedRoleKeys, setSelectedRoleKeys] = useState<Set<string>>(new Set());
  const [saveState, setSaveState] = useState<AuthorizationApiResult<AuthorizationRole[]> | null>(
    null,
  );
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (!open) {
      return;
    }

    let current = true;
    setSelectedRoleKeys(new Set(user.roles.map((role) => role.key)));
    setCatalogState({ kind: "loading" });
    setSaveState(null);
    setIsSaving(false);

    void listAssignableAuthorizationRoles().then((result) => {
      if (!current) {
        return;
      }

      if (result.kind === "success") {
        setCatalogState({ kind: "ready", roles: result.data.filter((role) => role.isActive) });
        return;
      }

      setCatalogState(result);
    });

    return () => {
      current = false;
    };
  }, [open, user]);

  function toggleRole(roleKey: string) {
    setSelectedRoleKeys((current) => {
      const next = new Set(current);

      if (next.has(roleKey)) {
        next.delete(roleKey);
      } else {
        next.add(roleKey);
      }

      return next;
    });
    setSaveState(null);
  }

  async function saveRoles() {
    setIsSaving(true);
    const result = await replaceAuthorizationUserRoles(user.id, [...selectedRoleKeys].sort());
    setIsSaving(false);
    setSaveState(result);

    if (result.kind === "success") {
      onRolesUpdated(user.id, result.data);
      onOpenChange(false);
    }
  }

  const activeRoles = catalogState.kind === "ready" ? catalogState.roles : [];
  const saveError =
    saveState?.kind === "error"
      ? saveState.message
      : saveState?.kind === "unauthorized"
        ? "Tu sesión ya no permite modificar asignaciones."
        : null;

  return (
    <Dialog onOpenChange={onOpenChange} open={open}>
      <DialogContent className="max-h-[calc(100dvh-2rem)] max-w-xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Administrar roles</DialogTitle>
          <DialogDescription>
            Selecciona los roles activos para {user.name}. La persona debe conservar al menos un
            rol.
          </DialogDescription>
        </DialogHeader>
        {catalogState.kind === "loading" ? (
          <p aria-live="polite" className="text-sm leading-6 text-muted">
            Cargando roles disponibles…
          </p>
        ) : null}
        {catalogState.kind === "unauthorized" ? (
          <p role="alert" className="text-sm leading-6 text-danger">
            No tienes permiso para consultar los roles disponibles.
          </p>
        ) : null}
        {catalogState.kind === "error" ? (
          <p role="alert" className="text-sm leading-6 text-danger">
            {catalogState.message}
          </p>
        ) : null}
        {catalogState.kind === "ready" ? (
          <form
            className="space-y-5"
            onSubmit={(event) => {
              event.preventDefault();
              void saveRoles();
            }}
          >
            <fieldset>
              <legend className="text-sm font-semibold text-foreground">Roles activos</legend>
              <p className="mt-1 text-sm leading-6 text-muted">
                Puedes asignar más de un rol. Los permisos se acumulan.
              </p>
              <div className="mt-4 space-y-2">
                {activeRoles.map((role) => (
                  <label
                    className="flex cursor-pointer items-start gap-3 rounded-md border border-border px-3 py-3 text-sm hover:border-border-strong"
                    key={role.key}
                  >
                    <Checkbox
                      checked={selectedRoleKeys.has(role.key)}
                      className="mt-0.5"
                      onCheckedChange={() => toggleRole(role.key)}
                    />
                    <span>
                      <span className="font-semibold text-foreground">{role.name}</span>
                      <span className="ml-2 text-xs font-medium text-muted">
                        {role.kind === "system" ? "Sistema" : "Personalizado"}
                      </span>
                      <span className="mt-1 block leading-5 text-muted">{role.description}</span>
                    </span>
                  </label>
                ))}
              </div>
            </fieldset>

            {activeRoles.length === 0 ? (
              <p role="alert" className="text-sm leading-6 text-danger">
                No hay roles activos disponibles para asignar.
              </p>
            ) : null}
            {selectedRoleKeys.size === 0 ? (
              <p role="alert" className="text-sm leading-6 text-danger">
                Cada persona debe conservar al menos un rol activo.
              </p>
            ) : null}
            {saveError ? (
              <p role="alert" className="text-sm leading-6 text-danger">
                {saveError}
              </p>
            ) : null}

            <div className="flex flex-col-reverse gap-2 border-t border-border pt-4 sm:flex-row sm:justify-end">
              <Button onClick={() => onOpenChange(false)} variant="ghost">
                Cancelar
              </Button>
              <Button
                disabled={isSaving || activeRoles.length === 0 || selectedRoleKeys.size === 0}
                type="submit"
              >
                Guardar roles
              </Button>
            </div>
          </form>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
