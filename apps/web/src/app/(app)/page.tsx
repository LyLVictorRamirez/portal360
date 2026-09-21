"use client";

import { DataTable, type DataTableColumn } from "../../components/ui/data-table";
import { PageHeader } from "../../components/ui/page-header";
import { SelectField } from "../../components/ui/select-field";
import { StatusBadge, type StatusBadgeTone } from "../../components/ui/status-badge";
import { Surface } from "../../components/ui/surface";
import { TextField } from "../../components/ui/text-field";
import { WorkList, type WorkListItem } from "../../components/ui/work-list";

type SampleDetailRow = {
  context: string;
  id: string;
  priority: string;
  status: {
    label: string;
    tone: StatusBadgeTone;
  };
  title: string;
};

const workItems: readonly WorkListItem[] = [
  {
    context: "Plantilla de lectura · sin proceso asociado",
    id: "muestra-revisar",
    priority: {
      label: "Alta",
      tone: "high",
    },
    responsible: "Rol de muestra",
    status: {
      label: "Por revisar",
      tone: "warning",
    },
    title: "Revisar el siguiente punto de trabajo",
  },
  {
    context: "Plantilla de lectura · sin proceso asociado",
    id: "muestra-contexto",
    priority: {
      label: "Media",
      tone: "medium",
    },
    responsible: "Equipo de muestra",
    status: {
      label: "En preparación",
      tone: "info",
    },
    title: "Alinear el contexto de una decisión",
  },
  {
    context: "Plantilla de lectura · sin proceso asociado",
    id: "muestra-cierre",
    priority: {
      label: "Baja",
      tone: "low",
    },
    responsible: "Sin asignar",
    status: {
      label: "Pendiente",
      tone: "neutral",
    },
    title: "Cerrar la revisión de ejemplo",
  },
];

const detailRows: readonly SampleDetailRow[] = [
  {
    context: "Lectura priorizada",
    id: "detalle-revisar",
    priority: "Alta",
    status: {
      label: "Por revisar",
      tone: "warning",
    },
    title: "Punto de revisión",
  },
  {
    context: "Contexto de decisión",
    id: "detalle-contexto",
    priority: "Media",
    status: {
      label: "En preparación",
      tone: "info",
    },
    title: "Señal de contexto",
  },
  {
    context: "Cierre de ejemplo",
    id: "detalle-cierre",
    priority: "Baja",
    status: {
      label: "Pendiente",
      tone: "neutral",
    },
    title: "Siguiente lectura",
  },
];

const detailColumns: readonly DataTableColumn<SampleDetailRow>[] = [
  {
    cell: (row) => <span className="font-semibold text-foreground">{row.title}</span>,
    header: "Elemento de muestra",
    id: "element",
  },
  {
    cell: (row) => <span className="text-muted">{row.context}</span>,
    header: "Referencia",
    id: "context",
  },
  {
    cell: (row) => <StatusBadge label={row.status.label} tone={row.status.tone} />,
    header: "Estado",
    id: "status",
  },
  {
    align: "right",
    cell: (row) => <span className="font-semibold text-foreground">{row.priority}</span>,
    header: "Prioridad",
    id: "priority",
  },
];

export default function HomePage() {
  return (
    <div className="mx-auto w-full max-w-6xl">
      <PageHeader
        actions={
          <a
            className="inline-flex h-10 items-center text-sm font-semibold text-primary underline decoration-primary/30 underline-offset-4 transition-colors hover:text-primary-hover"
            href="#detalle-de-muestra"
          >
            Ver detalle de la muestra
          </a>
        }
        description="Una muestra estática para ordenar la lectura diaria, sin procesos ni datos conectados."
        title="Foco de trabajo"
      />

      <div className="space-y-8 pt-8">
        <Surface padding="md" tone="muted">
          <div className="flex flex-col gap-2 border-b border-border pb-5 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <h2 className="text-xl font-semibold tracking-tight text-foreground">
                Explorar la plantilla
              </h2>
              <p className="mt-1.5 max-w-2xl text-sm leading-6 text-muted">
                Los filtros describen la estructura de la vista. Se activarán cuando exista un
                módulo con datos.
              </p>
            </div>
            <StatusBadge label="Muestra estática" tone="info" />
          </div>

          <form
            aria-describedby="filter-sample-note"
            aria-label="Filtros de muestra"
            className="mt-5"
          >
            <div className="grid gap-4 md:grid-cols-3">
              <SelectField defaultValue="todo" disabled label="Horizonte de lectura">
                <option value="todo">Todo el contenido de muestra</option>
              </SelectField>
              <SelectField defaultValue="prioridad" disabled label="Orden de revisión">
                <option value="prioridad">Prioridad primero</option>
              </SelectField>
              <TextField defaultValue="Sin búsqueda" disabled label="Buscar en la muestra" />
            </div>
            <p className="mt-4 text-sm leading-6 text-muted" id="filter-sample-note">
              Los controles están deshabilitados porque esta pantalla no consulta ni modifica
              información.
            </p>
          </form>
        </Surface>

        <section aria-labelledby="prioritized-reading-title">
          <div className="flex flex-col gap-2 pb-4 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h2
                className="text-xl font-semibold tracking-tight text-foreground"
                id="prioritized-reading-title"
              >
                Lectura priorizada
              </h2>
              <p className="mt-1.5 max-w-2xl text-sm leading-6 text-muted">
                Filas compactas para contrastar contexto, estado, prioridad y responsable sin
                representar trabajo real.
              </p>
            </div>
            <StatusBadge label="Contenido de muestra" tone="neutral" />
          </div>
          <Surface className="overflow-hidden" padding="none">
            <WorkList
              className="border-y-0"
              items={workItems}
              label="Ejemplos de lectura priorizada"
            />
          </Surface>
        </section>

        <section aria-labelledby="sample-detail-title" id="detalle-de-muestra">
          <div className="flex flex-col gap-2 pb-4 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h2
                className="text-xl font-semibold tracking-tight text-foreground"
                id="sample-detail-title"
              >
                Detalle de la muestra
              </h2>
              <p className="mt-1.5 max-w-2xl text-sm leading-6 text-muted">
                Una tabla compacta conserva la lectura completa en pantallas pequeñas mediante
                desplazamiento horizontal.
              </p>
            </div>
          </div>
          <DataTable
            columns={detailColumns}
            label="Detalle del contenido de muestra"
            rows={detailRows}
          />
        </section>
      </div>
    </div>
  );
}
