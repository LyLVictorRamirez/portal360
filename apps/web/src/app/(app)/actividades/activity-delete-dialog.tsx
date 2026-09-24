"use client";

import { useState } from "react";

import { Button } from "../../../components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "../../../components/ui/dialog";
import { deleteActivity, type Activity } from "../../../lib/activities-client";

export function ActivityDeleteDialog({
  activity,
  onDeleted,
  onOpenChange,
  open,
}: Readonly<{
  activity: Activity;
  onDeleted: () => void;
  onOpenChange: (open: boolean) => void;
  open: boolean;
}>) {
  const [error, setError] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  async function remove() {
    setIsDeleting(true);
    setError(null);
    const result = await deleteActivity(activity.id, activity.version);
    setIsDeleting(false);
    if (result.kind === "success") {
      onDeleted();
      onOpenChange(false);
      return;
    }
    setError(
      result.kind === "conflict"
        ? result.message
        : result.kind === "validation"
          ? result.message
          : "No fue posible eliminar la Actividad.",
    );
  }
  return (
    <Dialog onOpenChange={(next) => !isDeleting && onOpenChange(next)} open={open}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Eliminar Actividad</DialogTitle>
          <DialogDescription>
            Eliminarás “{activity.name}”. Esta acción no se puede deshacer.
          </DialogDescription>
        </DialogHeader>
        {error ? (
          <p className="text-sm text-danger" role="alert">
            {error}
          </p>
        ) : null}
        <DialogFooter>
          <Button
            disabled={isDeleting}
            onClick={() => onOpenChange(false)}
            type="button"
            variant="cancel"
          >
            Cancelar
          </Button>
          <Button
            disabled={isDeleting}
            onClick={() => void remove()}
            type="button"
            variant="destructive"
          >
            {isDeleting ? "Eliminando…" : "Eliminar Actividad"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
