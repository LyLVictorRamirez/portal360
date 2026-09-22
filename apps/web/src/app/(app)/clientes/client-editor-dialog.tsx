"use client";

import { useEffect, useState } from "react";

import { Button } from "../../../components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "../../../components/ui/dialog";
import { StatusBadge } from "../../../components/ui/status-badge";
import { Switch } from "../../../components/ui/switch";
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

  return (
    <Dialog onOpenChange={onOpenChange} open={open}>
      <DialogContent className="max-h-[calc(100dvh-2rem)] max-w-lg overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        {isReadOnly && client ? (
          <div className="space-y-6">
            <dl className="grid gap-5 rounded-xl bg-muted/45 px-4 py-5 text-sm sm:px-5">
              <div className="flex flex-col gap-1.5 sm:flex-row sm:items-baseline sm:justify-between sm:gap-6">
                <dt className="font-medium text-muted-foreground">Código</dt>
                <dd className="font-semibold tabular-nums text-primary">{client.code}</dd>
              </div>
              <div className="flex flex-col gap-1.5 sm:flex-row sm:items-baseline sm:justify-between sm:gap-6">
                <dt className="font-medium text-muted-foreground">Nombre</dt>
                <dd className="font-semibold text-foreground">{client.name}</dd>
              </div>
              <div className="flex flex-col gap-1.5 sm:flex-row sm:items-center sm:justify-between sm:gap-6">
                <dt className="font-medium text-muted-foreground">Estado</dt>
                <dd>
                  <StatusBadge
                    label={client.isActive ? "Activo" : "Inactivo"}
                    tone={client.isActive ? "success" : "inactive"}
                  />
                </dd>
              </div>
            </dl>
            <div className="flex justify-end">
              <Button onClick={() => onOpenChange(false)} variant="cancel">
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
              <p className="rounded-md border border-border bg-surface-muted px-3 py-2 text-sm leading-6 text-muted-foreground">
                Código asignado:{" "}
                <code className="font-semibold tabular-nums text-primary">{client.code}</code>
              </p>
            ) : null}

            <TextField
              autoComplete="organization"
              error={formError}
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
              <div className="flex items-center justify-between rounded-md border border-border px-3 py-3 text-sm">
                <label className="font-semibold text-foreground" htmlFor="client-active">
                  Cliente activo
                </label>
                <Switch
                  checked={isActive}
                  id="client-active"
                  onCheckedChange={(checked) => {
                    setIsActive(checked === true);
                    setSaveState(null);
                  }}
                />
              </div>
            ) : null}

            {saveError ? (
              <p role="alert" className="text-sm leading-6 text-danger">
                {saveError}
              </p>
            ) : null}

            <div className="flex flex-col-reverse gap-2 border-t border-border pt-4 sm:flex-row sm:justify-end">
              <Button disabled={isSaving} onClick={() => onOpenChange(false)} type="button" variant="cancel">
                Cancelar
              </Button>
              <Button disabled={isSaving} type="submit">
                {isSaving ? "Guardando…" : isCreating ? "Crear Cliente" : "Guardar cambios"}
              </Button>
            </div>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
