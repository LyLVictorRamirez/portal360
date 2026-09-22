"use client";

import { useEffect, useState } from "react";

import { canManageProjectStages } from "./project-stages-access";
import { Button } from "../../../components/ui/button";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "../../../components/ui/alert-dialog";
import { TextField } from "../../../components/ui/text-field";
import {
  createProjectStage,
  deleteProjectStage,
  moveProjectStage,
  updateProjectStage,
  type ProjectStage,
  type ProjectStatus,
} from "../../../lib/projects-client";

type ProjectStagesSectionProps = Readonly<{
  canManage: boolean;
  onStagesChange: (stages: readonly ProjectStage[]) => void;
  projectId: string;
  status: ProjectStatus;
  stages: readonly ProjectStage[];
}>;

function getStageErrorMessage(kind: "conflict" | "error" | "unauthorized" | "validation") {
  if (kind === "unauthorized") {
    return "Tu sesión no tiene permisos para gestionar Etapas.";
  }

  if (kind === "conflict") {
    return "Las Etapas cambiaron mientras trabajabas. Cierra el detalle y vuelve a abrirlo.";
  }

  if (kind === "validation") {
    return "Revisa el nombre o la posición de la Etapa e inténtalo nuevamente.";
  }

  return "No fue posible completar la operación sobre la Etapa.";
}

export function ProjectStagesSection({
  canManage,
  onStagesChange,
  projectId,
  status,
  stages,
}: ProjectStagesSectionProps) {
  const [editingStageId, setEditingStageId] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [newStageName, setNewStageName] = useState("");
  const [stageName, setStageName] = useState("");
  const [stageToDelete, setStageToDelete] = useState<ProjectStage | null>(null);

  const isTerminal = status === "finalized" || status === "cancelled";
  const isReadOnly = !canManageProjectStages(canManage, status);

  useEffect(() => {
    setEditingStageId(null);
    setErrorMessage(null);
    setIsSaving(false);
    setNewStageName("");
    setStageName("");
    setStageToDelete(null);
  }, [projectId]);

  function replaceStage(updatedStage: ProjectStage) {
    onStagesChange(
      stages
        .map((stage) => (stage.id === updatedStage.id ? updatedStage : stage))
        .sort((left, right) => left.position - right.position || left.id.localeCompare(right.id)),
    );
  }

  async function addStage() {
    const name = newStageName.trim();

    if (!name || name.length > 15) {
      setErrorMessage("El nombre de la Etapa es obligatorio y debe tener máximo 15 caracteres.");
      return;
    }

    setErrorMessage(null);
    setIsSaving(true);
    const result = await createProjectStage(projectId, { name });
    setIsSaving(false);

    if (result.kind !== "success") {
      setErrorMessage(getStageErrorMessage(result.kind));
      return;
    }

    onStagesChange([...stages, result.data]);
    setNewStageName("");
  }

  async function saveStage(stage: ProjectStage) {
    const name = stageName.trim();

    if (!name || name.length > 15) {
      setErrorMessage("El nombre de la Etapa es obligatorio y debe tener máximo 15 caracteres.");
      return;
    }

    setErrorMessage(null);
    setIsSaving(true);
    const result = await updateProjectStage(projectId, stage.id, { name, version: stage.version });
    setIsSaving(false);

    if (result.kind !== "success") {
      setErrorMessage(getStageErrorMessage(result.kind));
      return;
    }

    replaceStage(result.data);
    setEditingStageId(null);
  }

  async function reorderStage(stage: ProjectStage, direction: "up" | "down") {
    setErrorMessage(null);
    setIsSaving(true);
    const result = await moveProjectStage(projectId, stage.id, { direction, version: stage.version });
    setIsSaving(false);

    if (result.kind !== "success") {
      setErrorMessage(getStageErrorMessage(result.kind));
      return;
    }

    const adjacentPosition = stage.position + (direction === "up" ? -1 : 1);
    const adjacentStage = stages.find((candidate) => candidate.position === adjacentPosition);
    const updatedStages = stages.map((candidate) => {
      if (candidate.id === stage.id) {
        return result.data;
      }

      if (candidate.id === adjacentStage?.id) {
        return { ...candidate, position: stage.position, version: candidate.version + 1 };
      }

      return candidate;
    });

    onStagesChange(updatedStages.sort((left, right) => left.position - right.position));
  }

  async function removeStage() {
    if (!stageToDelete) {
      return;
    }

    setErrorMessage(null);
    setIsSaving(true);
    const result = await deleteProjectStage(projectId, stageToDelete.id, stageToDelete.version);
    setIsSaving(false);

    if (result.kind !== "success") {
      setErrorMessage(getStageErrorMessage(result.kind));
      return;
    }

    onStagesChange(stages.filter((stage) => stage.id !== stageToDelete.id));
    setStageToDelete(null);
  }

  return (
    <section aria-labelledby="project-stages-title" className="space-y-4 border-t border-border pt-6">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <div>
          <h2 className="font-semibold text-foreground" id="project-stages-title">
            Etapas
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Define el orden de trabajo del Proyecto.
          </p>
        </div>
        <span className="text-sm tabular-nums text-muted-foreground">{stages.length} en total</span>
      </div>

      {isTerminal ? (
        <p className="rounded-md border border-border bg-muted/45 px-3 py-2 text-sm text-muted-foreground">
          El Proyecto está cerrado; sus Etapas se muestran en solo lectura.
        </p>
      ) : null}

      {errorMessage ? (
        <p className="text-sm leading-6 text-danger" role="alert">
          {errorMessage}
        </p>
      ) : null}

      {!isReadOnly ? (
        <form
          className="flex flex-col gap-2 rounded-lg bg-muted/45 p-3 sm:flex-row sm:items-end"
          onSubmit={(event) => {
            event.preventDefault();
            void addStage();
          }}
        >
          <TextField
            className="flex-1"
            disabled={isSaving}
            helpText={`${newStageName.length}/15`}
            id="project-stage-new"
            label="Nueva Etapa"
            maxLength={15}
            onChange={(event) => setNewStageName(event.target.value)}
            value={newStageName}
          />
          <Button disabled={isSaving} type="submit">
            {isSaving ? "Guardando…" : "Agregar Etapa"}
          </Button>
        </form>
      ) : null}

      {stages.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border px-4 py-5 text-sm text-muted-foreground">
          Aún no hay Etapas. {isReadOnly ? "" : "Crea la primera para organizar el trabajo."}
        </div>
      ) : (
        <ol className="divide-y rounded-lg border border-border" aria-label="Etapas del Proyecto">
          {stages.map((stage, index) => {
            const isEditing = editingStageId === stage.id;

            return (
              <li className="flex gap-3 px-3 py-3 sm:px-4" key={stage.id}>
                <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold tabular-nums text-primary">
                  {stage.position}
                </span>
                <div className="min-w-0 flex-1">
                  {isEditing ? (
                    <div className="flex flex-wrap items-end gap-2">
                      <TextField
                        className="min-w-40 flex-1"
                        disabled={isSaving}
                        id={`project-stage-${stage.id}`}
                        label="Nombre de la Etapa"
                        maxLength={15}
                        onChange={(event) => setStageName(event.target.value)}
                        value={stageName}
                      />
                      <Button
                        disabled={isSaving}
                        onClick={() => void saveStage(stage)}
                        size="sm"
                        type="button"
                      >
                        Guardar
                      </Button>
                      <Button
                        disabled={isSaving}
                        onClick={() => setEditingStageId(null)}
                        size="sm"
                        type="button"
                        variant="cancel"
                      >
                        Cancelar
                      </Button>
                    </div>
                  ) : (
                    <p className="min-w-0 truncate pt-1 text-sm font-medium text-foreground">{stage.name}</p>
                  )}
                </div>
                {!isReadOnly && !isEditing ? (
                  <div className="flex shrink-0 flex-wrap justify-end gap-1">
                    <Button
                      aria-label={`Subir ${stage.name}`}
                      disabled={isSaving || index === 0}
                      onClick={() => void reorderStage(stage, "up")}
                      size="sm"
                      type="button"
                      variant="ghost"
                    >
                      Subir
                    </Button>
                    <Button
                      aria-label={`Bajar ${stage.name}`}
                      disabled={isSaving || index === stages.length - 1}
                      onClick={() => void reorderStage(stage, "down")}
                      size="sm"
                      type="button"
                      variant="ghost"
                    >
                      Bajar
                    </Button>
                    <Button
                      disabled={isSaving}
                      onClick={() => {
                        setEditingStageId(stage.id);
                        setErrorMessage(null);
                        setStageName(stage.name);
                      }}
                      size="sm"
                      type="button"
                      variant="ghost"
                    >
                      Editar
                    </Button>
                    <Button
                      disabled={isSaving}
                      onClick={() => setStageToDelete(stage)}
                      size="sm"
                      type="button"
                      variant="ghost"
                    >
                      Eliminar
                    </Button>
                  </div>
                ) : null}
              </li>
            );
          })}
        </ol>
      )}

      <AlertDialog onOpenChange={(open) => !open && setStageToDelete(null)} open={stageToDelete !== null}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Eliminar Etapa</AlertDialogTitle>
            <AlertDialogDescription>
              Esta acción no se puede deshacer.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <p className="text-sm text-muted-foreground">
            Eliminarás la Etapa <span className="font-semibold text-foreground">{stageToDelete?.name}</span>.
          </p>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isSaving}>Cancelar</AlertDialogCancel>
            <Button
              disabled={isSaving}
              onClick={() => void removeStage()}
              type="button"
              variant="destructive"
            >
              {isSaving ? "Eliminando…" : "Eliminar Etapa"}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </section>
  );
}
