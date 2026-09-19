"use client";

import { useEffect, useState } from "react";

import { Button } from "../../../components/ui/button";
import { Dialog } from "../../../components/ui/dialog";
import { StatusBadge } from "../../../components/ui/status-badge";
import { TextField } from "../../../components/ui/text-field";
import {
  createClient,
  updateClient,
  type Client,
  type ClientApiResult,
} from "../../../lib/clients-client";

export type ClientEditorMode = "create" | "edit" | "view";

type ClientEditorDialogProps = Readonly<{
  client: Client | null;
  mode: ClientEditorMode;
  onClientSaved: (client: Client, created: boolean) => void;
  onOpenChange: (open: boolean) => void;
  open: boolean;
}>;

export function ClientEditorDialog({
  client,
  mode,
  onClientSaved,
  onOpenChange,
  open,
}: ClientEditorDialogProps) {
  const [formError, setFormError] = useState<string | null>(null);
  const [isActive, setIsActive] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [name, setName] = useState("");
  const [saveState, setSaveState] = useState<ClientApiResult<Client> | null>(null);

  const isCreating = mode === "create";
  const isReadOnly = mode === "view";

  useEffect(() => {
    if (!open) {
      return;
    }

    setFormError(null);
    setIsActive(client?.isActive ?? true);
    setIsSaving(false);
    setName(client?.name ?? "");
    setSaveState(null);
  }, [client, open]);

  async function saveClient() {
    const normalizedName = name.trim();

    if (normalizedName.length < 1 || normalizedName.length > 200) {
      setFormError("El nombre debe contener entre 1 y 200 caracteres.");
      return;
    }

    setFormError(null);
    setIsSaving(true);
    const result = isCreating
      ? await createClient({ name: normalizedName })
      : await updateClient(client?.id ?? "", {
          isActive,
          name: normalizedName,
          version: client?.version ?? 0,
        });
    setIsSaving(false);
    setSaveState(result);

    if (result.kind === "success") {
      onClientSaved(result.data, isCreating);
      onOpenChange(false);
    }
  }

  const saveError =
    formError ??
    (saveState?.kind === "unauthorized"
      ? "Tu sesión ya no permite administrar Clientes."
      : saveState?.kind === "conflict"
        ? "El Cliente cambió mientras lo editabas. Ciérralo, recarga el listado y vuelve a intentarlo."
        : saveState?.kind === "validation" || saveState?.kind === "error"
          ? saveState.message
          : null);

  const title = isCreating ? "Crear Cliente" : isReadOnly ? "Detalle de Cliente" : "Editar Cliente";
  const description = isCreating
    ? "El código se asigna automáticamente al guardar y no se podrá modificar después."
    : isReadOnly
      ? "Consulta el código, nombre y estado actual de este Cliente."
      : "Actualiza el nombre o estado. El código asignado por el sistema no se puede modificar.";

  return (
    <Dialog description={description} onOpenChange={onOpenChange} open={open} title={title}>
      {isReadOnly && client ? (
        <div className="space-y-5">
          <dl className="divide-y divide-border border-y border-border text-sm">
            <div className="flex flex-col gap-1 py-3 sm:flex-row sm:items-baseline sm:justify-between sm:gap-6">
              <dt className="font-medium text-muted">Código</dt>
              <dd className="font-semibold tabular-nums text-primary">{client.code}</dd>
            </div>
            <div className="flex flex-col gap-1 py-3 sm:flex-row sm:items-baseline sm:justify-between sm:gap-6">
              <dt className="font-medium text-muted">Nombre</dt>
              <dd className="font-semibold text-foreground">{client.name}</dd>
            </div>
            <div className="flex flex-col gap-1 py-3 sm:flex-row sm:items-center sm:justify-between sm:gap-6">
              <dt className="font-medium text-muted">Estado</dt>
              <dd>
                <StatusBadge
                  label={client.isActive ? "Activo" : "Inactivo"}
                  tone={client.isActive ? "success" : "neutral"}
                />
              </dd>
            </div>
          </dl>
          <div className="flex justify-end border-t border-border pt-4">
            <Button onClick={() => onOpenChange(false)} variant="secondary">
              Cerrar
            </Button>
          </div>
        </div>
      ) : (
        <form
          className="space-y-5"
          onSubmit={(event) => {
            event.preventDefault();
            void saveClient();
          }}
        >
          {!isCreating && client ? (
            <p className="rounded-md border border-border bg-surface-muted px-3 py-2 text-sm leading-6 text-muted">
              Código asignado:{" "}
              <code className="font-semibold tabular-nums text-primary">{client.code}</code>
            </p>
          ) : null}

          <TextField
            autoComplete="organization"
            error={formError}
            helpText={isCreating ? "El código se genera al crear el Cliente." : undefined}
            label="Nombre"
            maxLength={200}
            onChange={(event) => {
              setName(event.target.value);
              setFormError(null);
              setSaveState(null);
            }}
            required
            value={name}
          />

          {!isCreating ? (
            <label className="flex cursor-pointer items-start gap-3 rounded-md border border-border px-3 py-3 text-sm hover:border-border-strong">
              <input
                checked={isActive}
                className="mt-0.5 size-4 accent-primary"
                onChange={(event) => {
                  setIsActive(event.target.checked);
                  setSaveState(null);
                }}
                type="checkbox"
              />
              <span>
                <span className="font-semibold text-foreground">Cliente activo</span>
                <span className="mt-1 block leading-5 text-muted">
                  Un Cliente inactivo se conserva y puede reactivarse después.
                </span>
              </span>
            </label>
          ) : null}

          {saveError ? (
            <p role="alert" className="text-sm leading-6 text-danger">
              {saveError}
            </p>
          ) : null}

          <div className="flex flex-col-reverse gap-2 border-t border-border pt-4 sm:flex-row sm:justify-end">
            <Button disabled={isSaving} onClick={() => onOpenChange(false)} variant="quiet">
              Cancelar
            </Button>
            <Button disabled={isSaving} type="submit">
              {isSaving ? "Guardando…" : isCreating ? "Crear Cliente" : "Guardar cambios"}
            </Button>
          </div>
        </form>
      )}
    </Dialog>
  );
}
