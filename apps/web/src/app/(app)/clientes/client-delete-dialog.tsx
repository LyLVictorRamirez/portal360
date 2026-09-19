"use client";

import { useEffect, useState } from "react";

import { Button } from "../../../components/ui/button";
import { Dialog } from "../../../components/ui/dialog";
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
    <Dialog
      description={`Eliminarás ${client.name} (${client.code}) de forma definitiva.`}
      onOpenChange={onOpenChange}
      open={open}
      title="Eliminar Cliente"
    >
      <div className="space-y-5">
        <p className="text-sm leading-6 text-muted">
          Esta acción no se puede deshacer. Solo se puede eliminar un Cliente sin relaciones de
          trabajo. Si ya está relacionado, puedes desactivarlo para conservar el historial.
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
          <Button disabled={isDeleting} onClick={() => void confirmDeletion()} variant="danger">
            {isDeleting ? "Eliminando…" : "Eliminar Cliente"}
          </Button>
        </div>
      </div>
    </Dialog>
  );
}
