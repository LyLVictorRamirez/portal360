"use client";

import { useEffect, useState } from "react";

import { Button } from "../../../components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "../../../components/ui/dialog";
import { deleteProject, type Project } from "../../../lib/projects-client";

type ProjectDeleteDialogProps = {
  onDeleted: (projectId: string) => void;
  onOpenChange: (open: boolean) => void;
  open: boolean;
  project: Project | null;
};

function getDeleteErrorMessage(kind: "conflict" | "error" | "unauthorized" | "validation") {
  if (kind === "unauthorized") {
    return "Tu sesión no tiene permisos para gestionar Proyectos.";
  }

  if (kind === "conflict") {
    return "El Proyecto tiene relaciones que impiden eliminarlo.";
  }

  if (kind === "validation") {
    return "No fue posible validar la eliminación del Proyecto.";
  }

  return "No fue posible eliminar el Proyecto. Inténtalo nuevamente.";
}

export function ProjectDeleteDialog({
  onDeleted,
  onOpenChange,
  open,
  project,
}: ProjectDeleteDialogProps) {
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    if (open) {
      setErrorMessage(null);
      setIsDeleting(false);
    }
  }, [open, project]);

  function closeDialog() {
    if (!isDeleting) {
      onOpenChange(false);
    }
  }

  async function removeProject() {
    if (!project) {
      return;
    }

    setIsDeleting(true);
    setErrorMessage(null);
    const result = await deleteProject(project.id);
    setIsDeleting(false);

    if (result.kind !== "success") {
      setErrorMessage(getDeleteErrorMessage(result.kind));
      return;
    }

    onDeleted(project.id);
    onOpenChange(false);
  }

  return (
    <Dialog onOpenChange={closeDialog} open={open}>
      <DialogContent className="max-h-[calc(100dvh-2rem)] max-w-lg overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Eliminar Proyecto</DialogTitle>
          <DialogDescription>Esta acción no se puede deshacer.</DialogDescription>
        </DialogHeader>
        <div className="space-y-5">
          <p className="text-sm leading-6 text-muted-foreground">
            Eliminarás el Proyecto{" "}
            <span className="font-semibold text-foreground">{project?.name}</span>{" "}
            <span className="font-mono">({project?.code})</span>. Esta acción no se puede deshacer.
          </p>

          {errorMessage ? (
            <p className="text-sm leading-6 text-danger" role="alert">
              {errorMessage}
            </p>
          ) : null}

          <div className="flex flex-col-reverse gap-2 border-t border-border pt-4 sm:flex-row sm:justify-end">
            <Button disabled={isDeleting} onClick={closeDialog} type="button" variant="ghost">
              Cancelar
            </Button>
            <Button
              disabled={isDeleting || !project}
              onClick={() => void removeProject()}
              type="button"
              variant="destructive"
            >
              {isDeleting ? "Eliminando…" : "Eliminar Proyecto"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
