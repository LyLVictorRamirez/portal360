"use client";

import { useEffect, useState } from "react";

import { ClientSearchField } from "./client-search-field";
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
import type { Client } from "../../../lib/clients-client";
import {
  createProject,
  projectStatuses,
  updateProject,
  type Project,
  type ProjectStatus,
} from "../../../lib/projects-client";

export type ProjectEditorMode = "create" | "edit" | "view";

type ProjectEditorDialogProps = {
  mode: ProjectEditorMode;
  onOpenChange: (open: boolean) => void;
  onProjectSaved: (project: Project, created: boolean) => void;
  open: boolean;
  project: Project | null;
};

const projectStatusLabels: Record<ProjectStatus, string> = {
  active: "Activo",
  cancelled: "Cancelado",
  finalized: "Finalizado",
  paused: "Pausado",
  planned: "Planeado",
};

const projectStatusTones: Record<ProjectStatus, StatusBadgeTone> = {
  active: "success",
  cancelled: "danger",
  finalized: "info",
  paused: "warning",
  planned: "planned",
};

function getSaveErrorMessage(kind: "conflict" | "error" | "unauthorized" | "validation") {
  if (kind === "unauthorized") {
    return "Tu sesión no tiene permisos para gestionar Proyectos.";
  }

  if (kind === "conflict") {
    return "El Proyecto cambió mientras lo editabas. Cierra esta ventana, recarga y vuelve a intentarlo.";
  }

  if (kind === "validation") {
    return "Revisa los datos del Proyecto e intenta nuevamente.";
  }

  return "No fue posible guardar el Proyecto. Inténtalo de nuevo.";
}

export function ProjectEditorDialog({
  mode,
  onOpenChange,
  onProjectSaved,
  open,
  project,
}: ProjectEditorDialogProps) {
  const isViewMode = mode === "view";
  const isCreateMode = mode === "create";
  const [committedEndDate, setCommittedEndDate] = useState("");
  const [description, setDescription] = useState("");
  const [formError, setFormError] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [startDate, setStartDate] = useState("");
  const [status, setStatus] = useState<ProjectStatus>("planned");

  useEffect(() => {
    if (!open) {
      return;
    }

    setCommittedEndDate(project?.committedEndDate ?? "");
    setDescription(project?.description ?? "");
    setFormError(null);
    setName(project?.name ?? "");
    setIsSaving(false);
    setSaveError(null);
    setSelectedClient(null);
    setStartDate(project?.startDate ?? "");
    setStatus(project?.status ?? "planned");
  }, [isCreateMode, open, project]);

  function closeDialog() {
    if (!isSaving) {
      onOpenChange(false);
    }
  }

  async function saveProject() {
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
      setFormError("Selecciona un Cliente activo para el Proyecto.");
      return;
    }

    if (!startDate || !committedEndDate) {
      setFormError("La fecha de inicio y la fecha comprometida son obligatorias.");
      return;
    }

    if (committedEndDate < startDate) {
      setFormError("La fecha comprometida no puede ser anterior a la fecha de inicio.");
      return;
    }

    setFormError(null);
    setIsSaving(true);
    setSaveError(null);

    const result = isCreateMode
      ? await createProject({
          clientId: clientId ?? "",
          committedEndDate,
          description: normalizedDescription,
          name: normalizedName,
          startDate,
          status,
        })
      : await updateProject(project?.id ?? "", {
          committedEndDate,
          description: normalizedDescription,
          name: normalizedName,
          startDate,
          status,
          version: project?.version ?? 0,
        });

    setIsSaving(false);

    if (result.kind !== "success") {
      setSaveError(getSaveErrorMessage(result.kind));
      return;
    }

    onProjectSaved(result.data, isCreateMode);
    onOpenChange(false);
  }

  const title = isCreateMode
    ? "Nuevo Proyecto"
    : isViewMode
      ? "Detalle del Proyecto"
      : "Editar Proyecto";
  return (
    <Dialog onOpenChange={closeDialog} open={open}>
      <DialogContent className="max-h-[calc(100dvh-2rem)] max-w-xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        {isViewMode && project ? (
          <div className="space-y-6">
            <dl className="grid gap-5 rounded-xl bg-muted/45 px-4 py-5 text-sm sm:grid-cols-2 sm:px-5">
              <div>
                <dt className="font-medium text-muted-foreground">Código</dt>
                <dd className="mt-1 font-semibold tabular-nums text-primary">{project.code}</dd>
              </div>
              <div>
                <dt className="font-medium text-muted-foreground">Estado</dt>
                <dd className="mt-1">
                  <StatusBadge
                    label={projectStatusLabels[project.status]}
                    tone={projectStatusTones[project.status]}
                  />
                </dd>
              </div>
              <div className="sm:col-span-2">
                <dt className="font-medium text-muted-foreground">Cliente</dt>
                <dd className="mt-1 text-foreground">
                  {project.client.name}{" "}
                  <span className="font-mono text-muted-foreground">({project.client.code})</span>
                </dd>
              </div>
              <div>
                <dt className="font-medium text-muted-foreground">Inicio</dt>
                <dd className="mt-1 text-foreground">{project.startDate}</dd>
              </div>
              <div>
                <dt className="font-medium text-muted-foreground">Fecha comprometida</dt>
                <dd className="mt-1 text-foreground">{project.committedEndDate}</dd>
              </div>
              <div className="sm:col-span-2">
                <dt className="font-medium text-muted-foreground">Descripción</dt>
                <dd className="mt-1 whitespace-pre-wrap text-foreground">
                  {project.description || "Sin descripción"}
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
              void saveProject();
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
                  {project?.client.name} <span className="font-mono">({project?.client.code})</span>
                </p>
              </div>
            )}

            <TextField
              disabled={isSaving}
              id="project-name"
              label="Nombre"
              maxLength={200}
              onChange={(event) => setName(event.target.value)}
              required
              value={name}
            />

            <TextareaField
              disabled={isSaving}
              helpText={`${description.length}/2.000`}
              id="project-description"
              label="Descripción"
              maxLength={2000}
              onChange={(event) => setDescription(event.target.value)}
              value={description}
            />

            <div className="grid gap-4 sm:grid-cols-2">
              <TextField
                disabled={isSaving}
                id="project-start-date"
                label="Fecha de inicio"
                onChange={(event) => setStartDate(event.target.value)}
                required
                type="date"
                value={startDate}
              />
              <TextField
                disabled={isSaving}
                id="project-committed-end-date"
                label="Fecha comprometida"
                min={startDate || undefined}
                onChange={(event) => setCommittedEndDate(event.target.value)}
                required
                type="date"
                value={committedEndDate}
              />
            </div>

            <SelectField
              disabled={isSaving}
              id="project-status"
              label="Estado"
              onChange={(event) => setStatus(event.target.value as ProjectStatus)}
              value={status}
            >
              {projectStatuses.map((projectStatus) => (
                <option key={projectStatus} value={projectStatus}>
                  {projectStatusLabels[projectStatus]}
                </option>
              ))}
            </SelectField>

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
                {isSaving ? "Guardando…" : isCreateMode ? "Crear Proyecto" : "Guardar cambios"}
              </Button>
            </div>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
