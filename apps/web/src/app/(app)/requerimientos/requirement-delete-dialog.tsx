"use client";

import { useEffect, useState } from "react";

import { Button } from "../../../components/ui/button";
import { Dialog } from "../../../components/ui/dialog";
import { deleteRequirement, type Requirement } from "../../../lib/requirements-client";

type RequirementDeleteDialogProps = {
  onDeleted: (requirementId: string) => void;
  onOpenChange: (open: boolean) => void;
  open: boolean;
  requirement: Requirement | null;
};

function getDeleteErrorMessage(kind: "conflict" | "error" | "unauthorized" | "validation") {
  if (kind === "unauthorized") {
    return "Tu sesión no tiene permisos para gestionar Requerimientos.";
  }

  if (kind === "conflict") {
    return "El Requerimiento tiene relaciones que impiden eliminarlo.";
  }

  if (kind === "validation") {
    return "No fue posible validar la eliminación del Requerimiento.";
  }

  return "No fue posible eliminar el Requerimiento. Inténtalo nuevamente.";
}

export function RequirementDeleteDialog({
  onDeleted,
  onOpenChange,
  open,
  requirement,
}: RequirementDeleteDialogProps) {
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    if (open) {
      setErrorMessage(null);
      setIsDeleting(false);
    }
  }, [open, requirement]);

  function closeDialog() {
    if (!isDeleting) {
      onOpenChange(false);
    }
  }

  async function removeRequirement() {
    if (!requirement) {
      return;
    }

    setIsDeleting(true);
    setErrorMessage(null);
    const result = await deleteRequirement(requirement.id);
    setIsDeleting(false);

    if (result.kind !== "success") {
      setErrorMessage(getDeleteErrorMessage(result.kind));
      return;
    }

    onDeleted(requirement.id);
    onOpenChange(false);
  }

  return (
    <Dialog
      description="Esta acción no se puede deshacer."
      onOpenChange={closeDialog}
      open={open}
      title="Eliminar Requerimiento"
    >
      <div className="space-y-5">
        <p className="text-sm leading-6 text-muted">
          Eliminarás el Requerimiento{" "}
          <span className="font-semibold text-foreground">{requirement?.name}</span>{" "}
          <span className="font-mono">({requirement?.code})</span>. Esta acción no se puede
          deshacer.
        </p>

        {errorMessage ? (
          <p className="text-sm leading-6 text-danger" role="alert">
            {errorMessage}
          </p>
        ) : null}

        <div className="flex flex-col-reverse gap-2 border-t border-border pt-4 sm:flex-row sm:justify-end">
          <Button disabled={isDeleting} onClick={closeDialog} type="button" variant="quiet">
            Cancelar
          </Button>
          <Button
            disabled={isDeleting || !requirement}
            onClick={() => void removeRequirement()}
            type="button"
            variant="danger"
          >
            {isDeleting ? "Eliminando…" : "Eliminar Requerimiento"}
          </Button>
        </div>
      </div>
    </Dialog>
  );
}
