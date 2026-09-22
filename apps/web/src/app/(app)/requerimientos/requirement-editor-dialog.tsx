"use client";

import { useEffect, useId, useState, type InputHTMLAttributes } from "react";

import { ClientSearchField } from "../proyectos/client-search-field";
import { Icons } from "../../../components/icons";
import { Button } from "../../../components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "../../../components/ui/dialog";
import { SelectField } from "../../../components/ui/select-field";
import { StatusBadge, type StatusBadgeTone } from "../../../components/ui/status-badge";
import { TextareaField } from "../../../components/ui/textarea-field";
import { TextField } from "../../../components/ui/text-field";
import { Field, FieldLabel } from "../../../components/ui/field";
import { Input } from "../../../components/ui/input";
import type { Client } from "../../../lib/clients-client";
import {
  createRequirement,
  updateRequirement,
  type Requirement,
  type RequirementStatus,
} from "../../../lib/requirements-client";

export type RequirementEditorMode = "create" | "edit" | "view";

type RequirementEditorDialogProps = {
  mode: RequirementEditorMode;
  onOpenChange: (open: boolean) => void;
  onRequirementSaved: (requirement: Requirement, created: boolean) => void;
  open: boolean;
  requirement: Requirement | null;
};

const requirementStatusLabels: Record<RequirementStatus, string> = {
  approved: "Aprobado",
  cancelled: "Cancelado",
  closed: "Cerrado",
  in_analysis: "En análisis",
  in_execution: "En ejecución",
  new: "Nuevo",
  quoted: "Cotizado",
};

const requirementStatusTones: Record<RequirementStatus, StatusBadgeTone> = {
  approved: "success",
  cancelled: "danger",
  closed: "info",
  in_analysis: "warning",
  in_execution: "success",
  new: "planned",
  quoted: "quoted",
};

const availableStatusTransitions: Record<RequirementStatus, readonly RequirementStatus[]> = {
  approved: ["approved", "in_execution", "cancelled"],
  cancelled: ["cancelled"],
  closed: ["closed"],
  in_analysis: ["in_analysis", "quoted", "cancelled"],
  in_execution: ["in_execution", "closed", "cancelled"],
  new: ["new", "in_analysis", "cancelled"],
  quoted: ["quoted", "approved", "cancelled"],
};

function getSaveErrorMessage(kind: "conflict" | "error" | "unauthorized" | "validation") {
  if (kind === "unauthorized") {
    return "Tu sesión no tiene permisos para gestionar Requerimientos.";
  }

  if (kind === "conflict") {
    return "El Requerimiento cambió mientras lo editabas. Cierra esta ventana, recarga y vuelve a intentarlo.";
  }

  if (kind === "validation") {
    return "Revisa las fechas y la transición de estado antes de guardar.";
  }

  return "No fue posible guardar el Requerimiento. Inténtalo de nuevo.";
}

function isQuotedOrLater(status: RequirementStatus) {
  return (
    status === "quoted" || status === "approved" || status === "in_execution" || status === "closed"
  );
}

function isApprovedOrLater(status: RequirementStatus) {
  return status === "approved" || status === "in_execution" || status === "closed";
}

type RequirementDateFieldProps = Omit<InputHTMLAttributes<HTMLInputElement>, "id" | "type"> & {
  id: string;
  label: string;
};

function RequirementDateField({ id, label, required, ...props }: RequirementDateFieldProps) {
  const labelId = useId();

  return (
    <Field>
      <FieldLabel id={labelId} htmlFor={id}>
        {label}
        {required ? <span aria-hidden="true"> *</span> : null}
      </FieldLabel>
      <div className="relative">
        <Icons.calendar
          aria-hidden="true"
          className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
        />
        <Input
          aria-labelledby={labelId}
          className="pl-10 [appearance:none] [&::-webkit-calendar-picker-indicator]:absolute [&::-webkit-calendar-picker-indicator]:inset-0 [&::-webkit-calendar-picker-indicator]:h-full [&::-webkit-calendar-picker-indicator]:w-full [&::-webkit-calendar-picker-indicator]:cursor-pointer [&::-webkit-calendar-picker-indicator]:opacity-0"
          id={id}
          required={required}
          type="date"
          {...props}
        />
      </div>
    </Field>
  );
}

export function RequirementEditorDialog({
  mode,
  onOpenChange,
  onRequirementSaved,
  open,
  requirement,
}: RequirementEditorDialogProps) {
  const isViewMode = mode === "view";
  const isCreateMode = mode === "create";
  const [approvedOn, setApprovedOn] = useState("");
  const [committedOn, setCommittedOn] = useState("");
  const [description, setDescription] = useState("");
  const [formError, setFormError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [name, setName] = useState("");
  const [quotedOn, setQuotedOn] = useState("");
  const [requestedOn, setRequestedOn] = useState("");
  const [saveError, setSaveError] = useState<string | null>(null);
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [status, setStatus] = useState<RequirementStatus>("new");

  useEffect(() => {
    if (!open) {
      return;
    }

    setApprovedOn(requirement?.approvedOn ?? "");
    setCommittedOn(requirement?.committedOn ?? "");
    setDescription(requirement?.description ?? "");
    setFormError(null);
    setIsSaving(false);
    setName(requirement?.name ?? "");
    setQuotedOn(requirement?.quotedOn ?? "");
    setRequestedOn(requirement?.requestedOn ?? "");
    setSaveError(null);
    setSelectedClient(null);
    setStatus(requirement?.status ?? "new");
  }, [isCreateMode, open, requirement]);

  function closeDialog() {
    if (!isSaving) {
      onOpenChange(false);
    }
  }

  async function saveRequirement() {
    const normalizedName = name.trim();
    const normalizedDescription = description.trim() || null;
    const clientId = selectedClient?.id;

    if (!normalizedName || normalizedName.length > 200) {
      setFormError("El nombre es obligatorio y debe tener máximo 200 caracteres.");
      return;
    }

    if (normalizedDescription && normalizedDescription.length > 2000) {
      setFormError("La descripción debe tener máximo 2.000 caracteres.");
      return;
    }

    if (isCreateMode && !clientId) {
      setFormError("Selecciona un Cliente activo para el Requerimiento.");
      return;
    }

    if (!requestedOn) {
      setFormError("La fecha es obligatoria.");
      return;
    }

    if (committedOn && committedOn < requestedOn) {
      setFormError("La fecha comprometida de entrega no puede ser anterior a la fecha.");
      return;
    }

    if (isQuotedOrLater(status) && !quotedOn) {
      setFormError("Indica la fecha de cotización para este estado.");
      return;
    }

    if (quotedOn && quotedOn < requestedOn) {
      setFormError("La fecha de cotización no puede ser anterior a la solicitud.");
      return;
    }

    if (isApprovedOrLater(status) && !approvedOn) {
      setFormError("Indica la fecha de aprobación para este estado.");
      return;
    }

    if (approvedOn && approvedOn < requestedOn) {
      setFormError("La fecha de aprobación no puede ser anterior a la solicitud.");
      return;
    }

    setFormError(null);
    setIsSaving(true);
    setSaveError(null);

    const result = isCreateMode
      ? await createRequirement({
          clientId: clientId ?? "",
          committedOn: committedOn || null,
          description: normalizedDescription,
          name: normalizedName,
          requestedOn,
        })
      : await updateRequirement(requirement?.id ?? "", {
          approvedOn: approvedOn || null,
          committedOn: committedOn || null,
          description: normalizedDescription,
          name: normalizedName,
          quotedOn: quotedOn || null,
          requestedOn,
          status,
          version: requirement?.version ?? 0,
        });

    setIsSaving(false);

    if (result.kind !== "success") {
      setSaveError(getSaveErrorMessage(result.kind));
      return;
    }

    onRequirementSaved(result.data, isCreateMode);
    onOpenChange(false);
  }

  const title = isCreateMode
    ? "Nuevo Requerimiento"
    : isViewMode
      ? "Detalle del Requerimiento"
      : "Editar Requerimiento";
  return (
    <Dialog onOpenChange={closeDialog} open={open}>
      <DialogContent className="max-h-[calc(100dvh-2rem)] max-w-xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        {isViewMode && requirement ? (
          <div className="space-y-6">
            <dl className="grid gap-5 rounded-xl bg-muted/45 px-4 py-5 text-sm sm:grid-cols-2 sm:px-5">
              <div>
                <dt className="font-medium text-muted-foreground">Código</dt>
                <dd className="mt-1 font-semibold tabular-nums text-primary">{requirement.code}</dd>
              </div>
              <div>
                <dt className="font-medium text-muted-foreground">Estado</dt>
                <dd className="mt-1">
                  <StatusBadge
                    label={requirementStatusLabels[requirement.status]}
                    tone={requirementStatusTones[requirement.status]}
                  />
                </dd>
              </div>
              <div className="sm:col-span-2">
                <dt className="font-medium text-muted-foreground">Nombre del requerimiento</dt>
                <dd className="mt-1 text-foreground">{requirement.name}</dd>
              </div>
              <div className="sm:col-span-2">
                <dt className="font-medium text-muted-foreground">Cliente</dt>
                <dd className="mt-1 text-foreground">
                  {requirement.client.name}{" "}
                  <span className="font-mono text-muted-foreground">
                    ({requirement.client.code})
                  </span>
                </dd>
              </div>
              <div>
                <dt className="font-medium text-muted-foreground">Fecha</dt>
                <dd className="mt-1 text-foreground">{requirement.requestedOn}</dd>
              </div>
              <div>
                <dt className="font-medium text-muted-foreground">Fecha de cotización</dt>
                <dd className="mt-1 text-foreground">{requirement.quotedOn ?? "Sin fecha"}</dd>
              </div>
              <div>
                <dt className="font-medium text-muted-foreground">Fecha aprobación cliente</dt>
                <dd className="mt-1 text-foreground">{requirement.approvedOn ?? "Sin fecha"}</dd>
              </div>
              <div>
                <dt className="font-medium text-muted-foreground">Fecha comprometida de entrega</dt>
                <dd className="mt-1 text-foreground">{requirement.committedOn ?? "Sin fecha"}</dd>
              </div>
              <div className="sm:col-span-2">
                <dt className="font-medium text-muted-foreground">Aprobado por</dt>
                <dd className="mt-1 text-foreground">
                  {requirement.approvedByUserName ?? "Sin aprobación registrada"}
                </dd>
              </div>
              <div className="sm:col-span-2">
                <dt className="font-medium text-muted-foreground">Descripción</dt>
                <dd className="mt-1 whitespace-pre-wrap text-foreground">
                  {requirement.description || "Sin descripción"}
                </dd>
              </div>
            </dl>
            <div className="flex justify-end">
              <Button onClick={closeDialog} type="button" variant="cancel">
                Cerrar
              </Button>
            </div>
          </div>
        ) : (
          <form
            className="space-y-5"
            onSubmit={(event) => {
              event.preventDefault();
              void saveRequirement();
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
                  {requirement?.client.name}{" "}
                  <span className="font-mono">({requirement?.client.code})</span>
                </p>
              </div>
            )}

            <TextField
              disabled={isSaving}
              id="requirement-name"
              label="Nombre"
              maxLength={200}
              onChange={(event) => setName(event.target.value)}
              required
              value={name}
            />

            <TextareaField
              disabled={isSaving}
              helpText={`${description.length}/2.000`}
              id="requirement-description"
              label="Descripción"
              maxLength={2000}
              onChange={(event) => setDescription(event.target.value)}
              value={description}
            />

            {!isCreateMode ? (
              <SelectField
                disabled={isSaving}
                helpText="Solo se muestran las transiciones disponibles para el estado actual."
                id="requirement-status"
                label="Estado"
                onChange={(event) => setStatus(event.target.value as RequirementStatus)}
                value={status}
              >
                {availableStatusTransitions[requirement?.status ?? "new"].map(
                  (availableStatus) => (
                    <option key={availableStatus} value={availableStatus}>
                      {requirementStatusLabels[availableStatus]}
                    </option>
                  ),
                )}
              </SelectField>
            ) : null}

            <div className="grid gap-4 sm:grid-cols-2">
              <RequirementDateField
                disabled={isSaving}
                id="requirement-requested-on"
                label="Fecha"
                onChange={(event) => setRequestedOn(event.target.value)}
                required
                value={requestedOn}
              />
              {!isCreateMode && isQuotedOrLater(status) ? (
                <RequirementDateField
                  disabled={isSaving}
                  id="requirement-quoted-on"
                  label="Fecha de cotización"
                  min={requestedOn || undefined}
                  onChange={(event) => setQuotedOn(event.target.value)}
                  required
                  value={quotedOn}
                />
              ) : null}
              {!isCreateMode && isApprovedOrLater(status) ? (
                <RequirementDateField
                  disabled={isSaving}
                  id="requirement-approved-on"
                  label="Fecha aprobación cliente"
                  min={requestedOn || undefined}
                  onChange={(event) => setApprovedOn(event.target.value)}
                  required
                  value={approvedOn}
                />
              ) : null}
              <RequirementDateField
                disabled={isSaving}
                id="requirement-committed-on"
                label="Fecha comprometida de entrega"
                min={requestedOn || undefined}
                onChange={(event) => setCommittedOn(event.target.value)}
                value={committedOn}
              />
            </div>

            {formError || saveError ? (
              <p className="text-sm leading-6 text-danger" role="alert">
                {formError || saveError}
              </p>
            ) : null}

            <div className="flex flex-col-reverse gap-2 border-t border-border pt-4 sm:flex-row sm:justify-end">
              <Button disabled={isSaving} onClick={closeDialog} type="button" variant="cancel">
                Cancelar
              </Button>
              <Button disabled={isSaving} type="submit">
                {isSaving ? "Guardando…" : isCreateMode ? "Crear Requerimiento" : "Guardar cambios"}
              </Button>
            </div>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
