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
import { deleteTicket, type Ticket } from "../../../lib/tickets-client";

type TicketDeleteDialogProps = Readonly<{
  onDeleted: (ticketId: string) => void;
  onOpenChange: (open: boolean) => void;
  open: boolean;
  ticket: Ticket | null;
}>;

function getDeleteErrorMessage(kind: "conflict" | "error" | "unauthorized" | "validation") {
  if (kind === "unauthorized") {
    return "Tu sesión no tiene permisos para gestionar Tickets.";
  }

  if (kind === "conflict") {
    return "El Ticket tiene Actividades relacionadas que impiden eliminarlo.";
  }

  return "No fue posible eliminar el Ticket. Inténtalo nuevamente.";
}

export function TicketDeleteDialog({
  onDeleted,
  onOpenChange,
  open,
  ticket,
}: TicketDeleteDialogProps) {
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    if (open) {
      setErrorMessage(null);
      setIsDeleting(false);
    }
  }, [open, ticket]);

  async function removeTicket() {
    if (!ticket) {
      return;
    }

    setIsDeleting(true);
    const result = await deleteTicket(ticket.id);
    setIsDeleting(false);

    if (result.kind !== "success") {
      setErrorMessage(getDeleteErrorMessage(result.kind));
      return;
    }

    onDeleted(ticket.id);
    onOpenChange(false);
  }

  return (
    <Dialog onOpenChange={(nextOpen) => !isDeleting && onOpenChange(nextOpen)} open={open}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Eliminar Ticket</DialogTitle>
          <DialogDescription>Esta acción no se puede deshacer.</DialogDescription>
        </DialogHeader>
        <div className="space-y-5">
          <p className="text-sm leading-6 text-muted-foreground">
            Eliminarás el Ticket{" "}
            <span className="font-semibold text-foreground">{ticket?.title}</span>{" "}
            <span className="font-mono">({ticket?.externalReference})</span>.
          </p>
          {errorMessage ? (
            <p className="text-sm text-danger" role="alert">
              {errorMessage}
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
              disabled={isDeleting || !ticket}
              onClick={() => void removeTicket()}
              type="button"
              variant="destructive"
            >
              {isDeleting ? "Eliminando…" : "Eliminar Ticket"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
