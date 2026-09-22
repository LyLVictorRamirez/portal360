"use client";

import { useEffect, useState } from "react";

import { validateTicketForm } from "./ticket-form";
import { ClientSearchField } from "../proyectos/client-search-field";
import { Button } from "../../../components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "../../../components/ui/dialog";
import { SelectField } from "../../../components/ui/select-field";
import { StatusBadge, type StatusBadgeTone } from "../../../components/ui/status-badge";
import { TextareaField } from "../../../components/ui/textarea-field";
import { TextField } from "../../../components/ui/text-field";
import type { Client } from "../../../lib/clients-client";
import {
  createTicket,
  ticketExternalPriorities,
  updateTicket,
  type Ticket,
  type TicketExternalPriority,
} from "../../../lib/tickets-client";

export type TicketEditorMode = "create" | "edit" | "view";

type TicketEditorDialogProps = Readonly<{
  mode: TicketEditorMode;
  onOpenChange: (open: boolean) => void;
  onTicketSaved: (ticket: Ticket, created: boolean) => void;
  open: boolean;
  ticket: Ticket | null;
}>;

const priorityLabels: Record<TicketExternalPriority, string> = {
  critical: "Crítica",
  high: "Alta",
  low: "Baja",
  medium: "Media",
};

const priorityTones: Record<TicketExternalPriority, StatusBadgeTone> = {
  critical: "danger",
  high: "warning",
  low: "success",
  medium: "planned",
};

function getSaveErrorMessage(kind: "conflict" | "error" | "unauthorized" | "validation") {
  if (kind === "unauthorized") {
    return "Tu sesión no tiene permisos para gestionar Tickets.";
  }

  if (kind === "conflict") {
    return "El Ticket cambió mientras lo editabas. Cierra esta ventana, recarga y vuelve a intentarlo.";
  }

  if (kind === "validation") {
    return "Revisa los datos del Ticket e intenta nuevamente.";
  }

  return "No fue posible guardar el Ticket. Inténtalo de nuevo.";
}

export function TicketEditorDialog({
  mode,
  onOpenChange,
  onTicketSaved,
  open,
  ticket,
}: TicketEditorDialogProps) {
  const isCreateMode = mode === "create";
  const isViewMode = mode === "view";
  const [description, setDescription] = useState("");
  const [externalPriority, setExternalPriority] = useState<TicketExternalPriority>("medium");
  const [externalReference, setExternalReference] = useState("");
  const [externalUrl, setExternalUrl] = useState("");
  const [formError, setFormError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [title, setTitle] = useState("");

  useEffect(() => {
    if (!open) {
      return;
    }

    setDescription(ticket?.description ?? "");
    setExternalPriority(ticket?.externalPriority ?? "medium");
    setExternalReference(ticket?.externalReference ?? "");
    setExternalUrl(ticket?.externalUrl ?? "");
    setFormError(null);
    setIsSaving(false);
    setSaveError(null);
    setSelectedClient(null);
    setTitle(ticket?.title ?? "");
  }, [open, ticket]);

  async function saveTicket() {
    const validation = validateTicketForm(
      {
        clientId: selectedClient?.id ?? null,
        description,
        externalPriority,
        externalReference,
        externalUrl,
        title,
      },
      isCreateMode,
    );

    if (validation.kind === "error") {
      setFormError(validation.message);
      return;
    }

    const values = validation.values;
    setFormError(null);
    setIsSaving(true);
    setSaveError(null);
    const result = isCreateMode
      ? await createTicket({
          clientId: values.clientId ?? "",
          description: values.description,
          externalPriority: values.externalPriority,
          externalReference: values.externalReference,
          externalUrl: values.externalUrl,
          title: values.title,
        })
      : await updateTicket(ticket?.id ?? "", {
          description: values.description,
          externalPriority: values.externalPriority,
          externalReference: values.externalReference,
          externalUrl: values.externalUrl,
          title: values.title,
          version: ticket?.version ?? 0,
        });
    setIsSaving(false);

    if (result.kind !== "success") {
      setSaveError(getSaveErrorMessage(result.kind));
      return;
    }

    onTicketSaved(result.data, isCreateMode);
    onOpenChange(false);
  }

  const dialogTitle = isCreateMode
    ? "Nuevo Ticket"
    : isViewMode
      ? "Detalle del Ticket"
      : "Editar Ticket";

  return (
    <Dialog onOpenChange={(nextOpen) => !isSaving && onOpenChange(nextOpen)} open={open}>
      <DialogContent className="max-h-[calc(100dvh-2rem)] max-w-xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{dialogTitle}</DialogTitle>
        </DialogHeader>
        {isViewMode && ticket ? (
          <div className="space-y-6">
            <dl className="grid gap-x-6 gap-y-5 rounded-xl bg-muted/45 px-4 py-5 text-sm sm:grid-cols-2 sm:px-5">
              <div className="sm:col-span-2">
                <dt className="font-medium text-muted-foreground">Título</dt>
                <dd className="mt-1 text-lg font-semibold leading-snug text-foreground">
                  {ticket.title}
                </dd>
              </div>
              <div>
                <dt className="font-medium text-muted-foreground">Referencia externa</dt>
                <dd className="mt-1 break-all font-semibold tabular-nums text-primary">
                  {ticket.externalReference}
                </dd>
              </div>
              <div>
                <dt className="font-medium text-muted-foreground">Prioridad</dt>
                <dd className="mt-1">
                  <StatusBadge
                    label={priorityLabels[ticket.externalPriority]}
                    tone={priorityTones[ticket.externalPriority]}
                  />
                </dd>
              </div>
              <div className="border-t border-border/70 pt-4 sm:col-span-2">
                <dt className="font-medium text-muted-foreground">Cliente</dt>
                <dd className="mt-1 text-foreground">
                  {ticket.client.name}{" "}
                  <span className="font-mono text-muted-foreground">({ticket.client.code})</span>
                </dd>
              </div>
              <div className="sm:col-span-2">
                <dt className="font-medium text-muted-foreground">URL externa</dt>
                <dd className="mt-1 break-all text-foreground">
                  {ticket.externalUrl ? (
                    <a
                      className="text-primary underline underline-offset-4 focus-visible:outline-2 focus-visible:outline-offset-2"
                      href={ticket.externalUrl}
                      rel="noopener noreferrer"
                      target="_blank"
                    >
                      Abrir Ticket externo
                    </a>
                  ) : (
                    "Sin URL"
                  )}
                </dd>
              </div>
              <div className="border-t border-border/70 pt-4 sm:col-span-2">
                <dt className="font-medium text-muted-foreground">Descripción</dt>
                <dd className="mt-1 whitespace-pre-wrap text-foreground">
                  {ticket.description || "Sin descripción"}
                </dd>
              </div>
            </dl>
            <div className="flex justify-end">
              <Button onClick={() => onOpenChange(false)} type="button" variant="cancel">
                Cerrar
              </Button>
            </div>
          </div>
        ) : (
          <form
            className="space-y-5"
            onSubmit={(event) => {
              event.preventDefault();
              void saveTicket();
            }}
          >
            {isCreateMode ? (
              <ClientSearchField
                disabled={isSaving}
                onSelectedClientChange={setSelectedClient}
                selectedClient={selectedClient}
              />
            ) : (
              <div className="rounded-md border border-border bg-surface-muted px-3 py-2 text-sm leading-6 text-muted-foreground">
                <p className="font-medium text-foreground">Cliente</p>
                <p>
                  {ticket?.client.name} <span className="font-mono">({ticket?.client.code})</span>
                </p>
              </div>
            )}
            <TextField
              disabled={isSaving}
              id="ticket-external-reference"
              label="Referencia externa"
              maxLength={200}
              onChange={(event) => setExternalReference(event.target.value)}
              required
              value={externalReference}
            />
            <TextField
              disabled={isSaving}
              id="ticket-title"
              label="Título"
              maxLength={200}
              onChange={(event) => setTitle(event.target.value)}
              required
              value={title}
            />
            <div className="grid gap-4 sm:grid-cols-2">
              <TextField
                disabled={isSaving}
                id="ticket-external-url"
                label="URL externa"
                maxLength={2048}
                onChange={(event) => setExternalUrl(event.target.value)}
                placeholder="https://…"
                type="url"
                value={externalUrl}
              />
              <SelectField
                disabled={isSaving}
                id="ticket-priority"
                label="Prioridad"
                onChange={(event) =>
                  setExternalPriority(event.target.value as TicketExternalPriority)
                }
                value={externalPriority}
              >
                {ticketExternalPriorities.map((priority) => (
                  <option key={priority} value={priority}>
                    {priorityLabels[priority]}
                  </option>
                ))}
              </SelectField>
            </div>
            <TextareaField
              disabled={isSaving}
              helpText={`${description.length}/2.000`}
              id="ticket-description"
              label="Descripción"
              maxLength={2000}
              onChange={(event) => setDescription(event.target.value)}
              value={description}
            />
            {formError || saveError ? (
              <p className="text-sm leading-6 text-danger" role="alert">
                {formError || saveError}
              </p>
            ) : null}
            <div className="flex flex-col-reverse gap-2 border-t border-border pt-4 sm:flex-row sm:justify-end">
              <Button
                disabled={isSaving}
                onClick={() => onOpenChange(false)}
                type="button"
                variant="cancel"
              >
                Cancelar
              </Button>
              <Button disabled={isSaving} type="submit">
                {isSaving ? "Guardando…" : isCreateMode ? "Crear Ticket" : "Guardar cambios"}
              </Button>
            </div>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
