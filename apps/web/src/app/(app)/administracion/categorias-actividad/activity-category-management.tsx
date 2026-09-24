"use client";

import { useEffect, useMemo, useState } from "react";

import { Icons } from "../../../../components/icons";
import { Button } from "../../../../components/ui/button";
import { DataTable, type DataTableColumn } from "../../../../components/ui/data-table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "../../../../components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "../../../../components/ui/dropdown-menu";
import { Input } from "../../../../components/ui/input";
import { PageHeader } from "../../../../components/ui/page-header";
import { StatusBadge } from "../../../../components/ui/status-badge";
import { Switch } from "../../../../components/ui/switch";
import {
  EmptyState,
  ErrorState,
  LoadingState,
  UnauthorizedState,
} from "../../../../components/states/interface-states";
import {
  createActivityCategory,
  listActivityCategories,
  updateActivityCategory,
  type ActivityCategory,
} from "../../../../lib/activity-categories-client";
import {
  filterActivityCategories,
  paginateActivityCategories,
  type ActivityCategoryAvailabilityFilter,
} from "../../../../lib/activity-category-list";

type CategoryState =
  | Readonly<{ kind: "loading" }>
  | Readonly<{ categories: readonly ActivityCategory[]; kind: "ready" }>
  | Readonly<{ kind: "unauthorized" }>
  | Readonly<{ kind: "error"; message: string }>;

const categoryPageSize = 25;

export function ActivityCategoryManagement() {
  const [editorCategory, setEditorCategory] = useState<ActivityCategory | null | undefined>(
    undefined,
  );
  const [availability, setAvailability] = useState<ActivityCategoryAvailabilityFilter>("all");
  const [page, setPage] = useState(1);
  const [query, setQuery] = useState("");
  const [reloadKey, setReloadKey] = useState(0);
  const [state, setState] = useState<CategoryState>({ kind: "loading" });
  const [updateMessage, setUpdateMessage] = useState<string | null>(null);

  useEffect(() => {
    let current = true;
    setState({ kind: "loading" });
    void listActivityCategories(true).then((result) => {
      if (!current) return;
      setState(
        result.kind === "success"
          ? { categories: result.data, kind: "ready" }
          : result.kind === "unauthorized"
            ? result
            : { kind: "error", message: result.message },
      );
    });
    return () => {
      current = false;
    };
  }, [reloadKey]);

  const categories = state.kind === "ready" ? state.categories : [];
  const filteredCategories = useMemo(
    () => filterActivityCategories(categories, { availability, query }),
    [availability, categories, query],
  );
  const totalPages = Math.max(1, Math.ceil(filteredCategories.length / categoryPageSize));
  const currentPage = Math.min(page, totalPages);
  const pageCategories = paginateActivityCategories(
    filteredCategories,
    currentPage,
    categoryPageSize,
  );
  const columns = createColumns((category) => {
    setEditorCategory(category);
    setUpdateMessage(null);
  });
  function saveCategory(category: ActivityCategory, created: boolean) {
    setUpdateMessage(created ? `Se creó ${category.name}.` : `Se actualizó ${category.name}.`);
    setReloadKey((value) => value + 1);
    setEditorCategory(undefined);
  }

  function updateQuery(nextQuery: string) {
    setQuery(nextQuery);
    setPage(1);
  }

  function updateAvailability(nextAvailability: ActivityCategoryAvailabilityFilter) {
    setAvailability(nextAvailability);
    setPage(1);
  }

  return (
    <div className="mx-auto flex min-h-0 w-full max-w-none flex-1 flex-col gap-8">
      <PageHeader
        actions={<Button onClick={() => setEditorCategory(null)}>Crear categoría</Button>}
        description="Organiza el trabajo operativo. Las categorías inactivas se conservan en el historial, pero no estarán disponibles para nuevas Actividades."
        title="Categorías de actividad"
      />
      {updateMessage ? (
        <p aria-live="polite" className="text-sm font-medium text-success">
          {updateMessage}
        </p>
      ) : null}
      {state.kind === "loading" ? <LoadingState title="Consultando categorías" /> : null}
      {state.kind === "unauthorized" ? <UnauthorizedState /> : null}
      {state.kind === "error" ? (
        <ErrorState
          action={<Button onClick={() => setReloadKey((value) => value + 1)}>Reintentar</Button>}
          description={state.message}
          title="No fue posible consultar las categorías"
        />
      ) : null}
      {state.kind === "ready" && categories.length === 0 ? (
        <EmptyState
          action={<Button onClick={() => setEditorCategory(null)}>Crear categoría</Button>}
          description="Crea la primera categoría para clasificar las Actividades."
          title="Aún no hay categorías"
        />
      ) : null}
      {state.kind === "ready" && categories.length > 0 ? (
        <section
          aria-labelledby="activity-category-table-title"
          className="flex min-h-0 flex-1 flex-col"
        >
          <h2 className="sr-only" id="activity-category-table-title">
            Categorías configuradas
          </h2>
          <DataTable
            className="min-h-0 flex-1"
            columns={columns}
            label="Categorías de Actividad"
            rows={pageCategories}
            scrollable
            showViewOptions
            toolbar={
              <ActivityCategoryFilters
                availability={availability}
                onAvailabilityChange={updateAvailability}
                onQueryChange={updateQuery}
                query={query}
              />
            }
          />
          <ActivityCategoryPagination
            onPageChange={setPage}
            page={currentPage}
            pageSize={categoryPageSize}
            total={filteredCategories.length}
          />
        </section>
      ) : null}
      {editorCategory !== undefined ? (
        <ActivityCategoryEditor
          category={editorCategory}
          onOpenChange={(open) => !open && setEditorCategory(undefined)}
          onSaved={saveCategory}
          open
        />
      ) : null}
    </div>
  );
}

function ActivityCategoryFilters({
  availability,
  onAvailabilityChange,
  onQueryChange,
  query,
}: Readonly<{
  availability: ActivityCategoryAvailabilityFilter;
  onAvailabilityChange: (value: ActivityCategoryAvailabilityFilter) => void;
  onQueryChange: (value: string) => void;
  query: string;
}>) {
  const availabilityLabel =
    availability === "all" ? undefined : availability === "active" ? "Activas" : "Inactivas";
  const hasFilters = query.trim().length > 0 || availability !== "all";

  return (
    <div
      aria-label="Buscar y filtrar Categorías de Actividad"
      className="flex flex-wrap items-center gap-2"
      role="search"
    >
      <label className="sr-only" htmlFor="activity-category-search">
        Buscar Categorías de Actividad
      </label>
      <Input
        autoComplete="off"
        className="w-full sm:w-72"
        id="activity-category-search"
        onChange={(event) => onQueryChange(event.target.value)}
        placeholder="Buscar Categorías..."
        type="search"
        value={query}
      />
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button size="sm" variant="outline">
            <Icons.adjustments />
            Disponibilidad
            {availabilityLabel ? <span className="text-primary">{availabilityLabel}</span> : null}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="min-w-48">
          <DropdownMenuLabel>Filtrar por disponibilidad</DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuRadioGroup
            onValueChange={(value) => onAvailabilityChange(value as ActivityCategoryAvailabilityFilter)}
            value={availability}
          >
            <DropdownMenuRadioItem value="all">Todas</DropdownMenuRadioItem>
            <DropdownMenuRadioItem value="active">Activas</DropdownMenuRadioItem>
            <DropdownMenuRadioItem value="inactive">Inactivas</DropdownMenuRadioItem>
          </DropdownMenuRadioGroup>
        </DropdownMenuContent>
      </DropdownMenu>
      {hasFilters ? (
        <Button
          onClick={() => {
            onQueryChange("");
            onAvailabilityChange("all");
          }}
          size="sm"
          variant="ghost"
        >
          <Icons.close />
          Restablecer
        </Button>
      ) : null}
    </div>
  );
}

function ActivityCategoryPagination({
  onPageChange,
  page,
  pageSize,
  total,
}: Readonly<{
  onPageChange: (page: number) => void;
  page: number;
  pageSize: number;
  total: number;
}>) {
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  return (
    <div
      aria-label="Paginación de Categorías de Actividad"
      className="shrink-0 flex flex-col gap-4 border-t border-border pt-4 sm:flex-row sm:items-center sm:justify-between"
      role="navigation"
    >
      <p className="text-sm text-muted-foreground">
        {total} {total === 1 ? "registro en total." : "registros en total."}
      </p>
      <div className="flex flex-wrap items-center gap-x-5 gap-y-3">
        <p className="text-sm font-medium text-foreground whitespace-nowrap">
          Filas por página
          <span className="ml-2 inline-flex h-8 min-w-12 items-center justify-center rounded-md border border-input bg-background px-3 text-sm font-normal shadow-xs">
            {pageSize}
          </span>
        </p>
        <p className="text-sm font-medium text-foreground whitespace-nowrap">
          Página {page} de {totalPages}
        </p>
        <div className="flex items-center gap-1">
          <Button
            aria-label="Ir a la primera página"
            disabled={page <= 1}
            onClick={() => onPageChange(1)}
            size="icon"
            variant="outline"
          >
            <Icons.chevronsLeft />
          </Button>
          <Button
            aria-label="Ir a la página anterior"
            disabled={page <= 1}
            onClick={() => onPageChange(page - 1)}
            size="icon"
            variant="outline"
          >
            <Icons.chevronLeft />
          </Button>
          <Button
            aria-label="Ir a la página siguiente"
            disabled={page >= totalPages}
            onClick={() => onPageChange(page + 1)}
            size="icon"
            variant="outline"
          >
            <Icons.chevronRight />
          </Button>
          <Button
            aria-label="Ir a la última página"
            disabled={page >= totalPages}
            onClick={() => onPageChange(totalPages)}
            size="icon"
            variant="outline"
          >
            <Icons.chevronsRight />
          </Button>
        </div>
      </div>
    </div>
  );
}

function ActivityCategoryEditor({
  category,
  onOpenChange,
  onSaved,
  open,
}: Readonly<{
  category: ActivityCategory | null;
  onOpenChange: (open: boolean) => void;
  onSaved: (category: ActivityCategory, created: boolean) => void;
  open: boolean;
}>) {
  const isCreate = category === null;
  const [error, setError] = useState<string | null>(null);
  const [isActive, setIsActive] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [name, setName] = useState("");

  useEffect(() => {
    if (!open) return;
    setError(null);
    setIsActive(category?.isActive ?? true);
    setIsSaving(false);
    setName(category?.name ?? "");
  }, [category, open]);

  async function save() {
    const normalizedName = name.trim();
    if (!normalizedName) {
      setError("Indica un nombre para la categoría.");
      return;
    }
    setError(null);
    setIsSaving(true);
    const result = isCreate
      ? await createActivityCategory(normalizedName)
      : await updateActivityCategory(category.id, {
          isActive,
          name: normalizedName,
          version: category.version,
        });
    setIsSaving(false);
    if (result.kind !== "success") {
      setError(
        result.kind === "conflict"
          ? "La categoría cambió mientras la editabas. Cierra esta ventana, recarga y vuelve a intentarlo."
          : result.kind === "unauthorized"
            ? "Tu sesión no permite administrar categorías."
            : result.message,
      );
      return;
    }
    onSaved(result.data, isCreate);
  }

  return (
    <Dialog onOpenChange={(next) => !isSaving && onOpenChange(next)} open={open}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{isCreate ? "Nueva categoría" : "Editar categoría"}</DialogTitle>
          <DialogDescription>
            {isCreate
              ? "La categoría quedará disponible para nuevas Actividades."
              : "Desactivar una categoría conserva su nombre en las Actividades históricas."}
          </DialogDescription>
        </DialogHeader>
        <form
          className="space-y-5"
          onSubmit={(event) => {
            event.preventDefault();
            void save();
          }}
        >
          <label
            className="grid gap-2 text-sm font-medium text-foreground"
            htmlFor="activity-category-name"
          >
            Nombre
            <Input
              disabled={isSaving}
              id="activity-category-name"
              maxLength={100}
              onChange={(event) => setName(event.target.value)}
              required
              value={name}
            />
          </label>
          {!isCreate ? (
            <div className="flex items-center justify-between gap-4 rounded-md border border-border px-3 py-3 text-sm">
              <label className="font-medium text-foreground" htmlFor="activity-category-active">
                Disponible para nuevas Actividades
              </label>
              <Switch
                checked={isActive}
                disabled={isSaving}
                id="activity-category-active"
                onCheckedChange={(checked) => setIsActive(checked === true)}
              />
            </div>
          ) : null}
          {error ? (
            <p className="text-sm leading-6 text-danger" role="alert">
              {error}
            </p>
          ) : null}
          <DialogFooter>
            <Button
              disabled={isSaving}
              onClick={() => onOpenChange(false)}
              type="button"
              variant="cancel"
            >
              Cancelar
            </Button>
            <Button disabled={isSaving} type="submit">
              {isSaving ? "Guardando…" : isCreate ? "Crear categoría" : "Guardar cambios"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function createColumns(
  onEdit: (category: ActivityCategory) => void,
): DataTableColumn<ActivityCategory>[] {
  return [
    {
      cell: (category) => <span className="font-semibold text-foreground">{category.name}</span>,
      header: "Categoría",
      hideable: true,
      id: "name",
      sortValue: (category) => category.name,
    },
    {
      cell: (category) => (
        <StatusBadge
          label={category.isActive ? "Activa" : "Inactiva"}
          tone={category.isActive ? "success" : "neutral"}
        />
      ),
      header: "Disponibilidad",
      hideable: true,
      id: "status",
      sortValue: (category) => (category.isActive ? 0 : 1),
    },
    {
      align: "right",
      cell: (category) => (
        <Button onClick={() => onEdit(category)} size="sm" variant="secondary">
          Editar
        </Button>
      ),
      header: "Acciones",
      id: "actions",
    },
  ];
}
