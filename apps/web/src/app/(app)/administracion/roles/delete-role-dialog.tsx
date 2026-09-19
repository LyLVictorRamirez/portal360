"use client";

import { useEffect, useState } from "react";

import { Button } from "../../../../components/ui/button";
import { Dialog } from "../../../../components/ui/dialog";
import {
  deleteAuthorizationRole,
  type AuthorizationApiResult,
  type AuthorizationRoleDetails,
} from "../../../../lib/authorization-roles-client";

type DeleteRoleDialogProps = Readonly<{
  onDeleted: (roleKey: string) => void;
  onOpenChange: (open: boolean) => void;
  open: boolean;
  role: AuthorizationRoleDetails;
}>;

export function DeleteRoleDialog({ onDeleted, onOpenChange, open, role }: DeleteRoleDialogProps) {
  const [deleteState, setDeleteState] = useState<AuthorizationApiResult<void> | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    if (open) {
      setDeleteState(null);
      setIsDeleting(false);
    }
  }, [open, role.key]);

  async function deleteRole() {
    setIsDeleting(true);
    const result = await deleteAuthorizationRole(role.key);
    setIsDeleting(false);
    setDeleteState(result);

    if (result.kind === "success") {
      onDeleted(role.key);
      onOpenChange(false);
    }
  }

  const deleteError =
    deleteState?.kind === "error"
      ? deleteState.message
      : deleteState?.kind === "unauthorized"
        ? "Tu sesión ya no permite eliminar roles."
        : null;

  return (
    <Dialog
      description={`Eliminarás el rol personalizado ${role.name}. Esta acción no se puede deshacer.`}
      onOpenChange={onOpenChange}
      open={open}
      title="Eliminar rol"
    >
      <div className="space-y-5">
        <p className="text-sm leading-6 text-muted">
          Solo se puede eliminar un rol que no esté asignado a ninguna persona. Si todavía tiene
          asignaciones, retíralas primero desde Usuarios.
        </p>
        {deleteError ? (
          <p role="alert" className="text-sm leading-6 text-danger">
            {deleteError}
          </p>
        ) : null}
        <div className="flex flex-col-reverse gap-2 border-t border-border pt-4 sm:flex-row sm:justify-end">
          <Button disabled={isDeleting} onClick={() => onOpenChange(false)} variant="quiet">
            Cancelar
          </Button>
          <Button disabled={isDeleting} onClick={() => void deleteRole()} variant="danger">
            {isDeleting ? "Eliminando…" : "Eliminar rol"}
          </Button>
        </div>
      </div>
    </Dialog>
  );
}
