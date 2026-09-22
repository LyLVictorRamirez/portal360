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
import { deleteClient, type Client, type ClientApiResult } from "../../../lib/clients-client";

type ClientDeleteDialogProps = Readonly<{
  client: Client;
  onDeleted: (client: Client) => void;
  onOpenChange: (open: boolean) => void;
  open: boolean;
}>;

export function ClientDeleteDialog({
  client,
  onDeleted,
  onOpenChange,
  open,
}: ClientDeleteDialogProps) {
  const [deleteState, setDeleteState] = useState<ClientApiResult<void> | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    if (open) {
      setDeleteState(null);
      setIsDeleting(false);
    }
  }, [client.id, open]);

  async function confirmDeletion() {
    setIsDeleting(true);
    const result = await deleteClient(client.id);
    setIsDeleting(false);
    setDeleteState(result);

    if (result.kind === "success") {
      onDeleted(client);
      onOpenChange(false);
    }
  }

  const deleteError =
    deleteState?.kind === "unauthorized"
      ? "Tu sesión ya no permite eliminar Clientes."
      : deleteState?.kind === "conflict"
        ? "Este Cliente tiene relaciones de trabajo y no se puede eliminar. Desactívalo si debe dejar de usarse."
        : deleteState?.kind === "validation" || deleteState?.kind === "error"
          ? deleteState.message
          : null;

  return (
    <Dialog onOpenChange={onOpenChange} open={open}>
      <DialogContent className="max-h-[calc(100dvh-2rem)] max-w-lg overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Eliminar Cliente</DialogTitle>
          <DialogDescription>
            Eliminarás {client.name} ({client.code}) de forma definitiva.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-5">
          <p className="text-sm leading-6 text-muted-foreground">
            Esta acción no se puede deshacer. Solo se puede eliminar un Cliente sin relaciones de
            trabajo. Si ya está relacionado, puedes desactivarlo para conservar el historial.
          </p>
          {deleteError ? (
            <p role="alert" className="text-sm leading-6 text-danger">
              {deleteError}
            </p>
          ) : null}
          <div className="flex flex-col-reverse gap-2 border-t border-border pt-4 sm:flex-row sm:justify-end">
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
              onClick={() => void confirmDeletion()}
              variant="destructive"
            >
              {isDeleting ? "Eliminando…" : "Eliminar Cliente"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
