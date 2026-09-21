"use client";

import { useEffect, useState } from "react";

import { ClientSearchField } from "../proyectos/client-search-field";
import { Button } from "../../../components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "../../../components/ui/dialog";
import { SelectField } from "../../../components/ui/select-field";
import { StatusBadge, type StatusBadgeTone } from "../../../components/ui/status-badge";
import { TextareaField } from "../../../components/ui/textarea-field";
import { TextField } from "../../../components/ui/text-field";
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
  closed: "neutral",
  in_analysis: "warning",
  in_execution: "info",
  new: "neutral",
  quoted: "info",
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
      setFormError("La fecha de solicitud es obligatoria.");
      return;
    }

    if (committedOn && committedOn < requestedOn) {
      setFormError("La fecha comprometida no puede ser anterior a la solicitud.");
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
  const descriptionText = isCreateMode
    ? "El código se asignará automáticamente al guardar."
    : "El Cliente y el código del Requerimiento no se pueden modificar.";

  return (
    <Dialog onOpenChange={closeDialog} open={open}>
      <DialogContent className="max-h-[calc(100dvh-2rem)] max-w-xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{descriptionText}</DialogDescription>
        </DialogHeader>
        {isViewMode && requirement ? (
          <div className="space-y-5">
            <dl className="grid gap-4 text-sm sm:grid-cols-2">
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
                <dt className="font-medium text-muted-foreground">Cliente</dt>
                <dd className="mt-1 text-foreground">
                  {requirement.client.name}{" "}
                  <span className="font-mono text-muted-foreground">
                    ({requirement.client.code})
                  </span>
                </dd>
              </div>
              <div>
                <dt className="font-medium text-muted-foreground">Solicitud</dt>
                <dd className="mt-1 text-foreground">{requirement.requestedOn}</dd>
              </div>
              <div>
                <dt className="font-medium text-muted-foreground">Compromiso</dt>
                <dd className="mt-1 text-foreground">{requirement.committedOn ?? "Sin fecha"}</dd>
              </div>
              <div>
                <dt className="font-medium text-muted-foreground">Cotización</dt>
                <dd className="mt-1 text-foreground">{requirement.quotedOn ?? "Sin fecha"}</dd>
              </div>
              <div>
                <dt className="font-medium text-muted-foreground">Aprobación</dt>
                <dd className="mt-1 text-foreground">{requirement.approvedOn ?? "Sin fecha"}</dd>
              </div>
              <div className="sm:col-span-2">
                <dt className="font-medium text-muted-foreground">Aprobado por</dt>
                <dd className="mt-1 text-foreground">
                  {requirement.approvedByUserId ?? "Sin aprobación registrada"}
                </dd>
              </div>
              <div className="sm:col-span-2">
                <dt className="font-medium text-muted-foreground">Descripción</dt>
                <dd className="mt-1 whitespace-pre-wrap text-foreground">
                  {requirement.description || "Sin descripción"}
                </dd>
              </div>
            </dl>
            <div className="flex justify-end border-t border-border pt-4">
              <Button onClick={closeDialog} type="button" variant="secondary">
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

            <div className="grid gap-4 sm:grid-cols-2">
              <TextField
                disabled={isSaving}
                id="requirement-requested-on"
                label="Fecha de solicitud"
                onChange={(event) => setRequestedOn(event.target.value)}
                required
                type="date"
                value={requestedOn}
              />
              <TextField
                disabled={isSaving}
                id="requirement-committed-on"
                label="Fecha comprometida"
                min={requestedOn || undefined}
                onChange={(event) => setCommittedOn(event.target.value)}
                type="date"
                value={committedOn}
              />
            </div>

            {!isCreateMode ? (
              <>
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

                {isQuotedOrLater(status) ? (
                  <TextField
                    disabled={isSaving}
                    id="requirement-quoted-on"
                    label="Fecha de cotización"
                    min={requestedOn || undefined}
                    onChange={(event) => setQuotedOn(event.target.value)}
                    required
                    type="date"
                    value={quotedOn}
                  />
                ) : null}

                {isApprovedOrLater(status) ? (
                  <TextField
                    disabled={isSaving}
                    id="requirement-approved-on"
                    label="Fecha de aprobación"
                    min={requestedOn || undefined}
                    onChange={(event) => setApprovedOn(event.target.value)}
                    required
                    type="date"
                    value={approvedOn}
                  />
                ) : null}
              </>
            ) : null}

            {formError || saveError ? (
              <p className="text-sm leading-6 text-danger" role="alert">
                {formError || saveError}
              </p>
            ) : null}

            <div className="flex flex-col-reverse gap-2 border-t border-border pt-4 sm:flex-row sm:justify-end">
              <Button disabled={isSaving} onClick={closeDialog} type="button" variant="ghost">
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
