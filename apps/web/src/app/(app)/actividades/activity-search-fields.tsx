"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";

import { Icons } from "../../../components/icons";
import { Button } from "../../../components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "../../../components/ui/command";
import { Label } from "../../../components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "../../../components/ui/popover";
import {
  listActivityAssignees,
  type Activity,
  type ActivityAssignee,
} from "../../../lib/activities-client";
import { listProjects, type ProjectStage } from "../../../lib/projects-client";
import { listRequirements } from "../../../lib/requirements-client";
import { listTickets } from "../../../lib/tickets-client";

type SearchOption = Readonly<{ detail?: string; id: string; label: string }>;
type SearchState =
  | Readonly<{ kind: "loading" }>
  | Readonly<{ kind: "ready"; options: readonly SearchOption[] }>
  | Readonly<{ kind: "unauthorized" }>
  | Readonly<{ kind: "error"; message: string }>;

<<<<<<< HEAD
=======
export function ActivityPredecessorSearchField({
  activities,
  disabled,
  emptyMessage,
  isLoading,
  onQueryChange,
  onSelected,
}: Readonly<{
  activities: readonly Activity[];
  disabled: boolean;
  emptyMessage: string;
  isLoading: boolean;
  onQueryChange: (query: string) => void;
  onSelected: (activity: Activity) => void;
}>) {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState("");
  const fieldRef = useRef<HTMLDivElement>(null);
  const triggerId = useId();

  function handleQueryChange(value: string) {
    setQuery(value);
    onQueryChange(value);
  }

  function selectActivity(activity: Activity) {
    onSelected(activity);
    setQuery("");
    onQueryChange("");
    setIsOpen(false);
  }

  return (
    <div className="space-y-1.5" ref={fieldRef}>
      <Label htmlFor={triggerId}>Agregar predecesora</Label>
      <Popover onOpenChange={setIsOpen} open={isOpen}>
        <PopoverTrigger asChild>
          <Button
            aria-expanded={isOpen}
            aria-haspopup="listbox"
            className="h-10 w-full justify-between border-border bg-surface px-3 text-left font-normal hover:bg-surface-muted"
            disabled={disabled}
            id={triggerId}
            role="combobox"
            variant="outline"
          >
            <span className="truncate text-muted-foreground">Buscar Actividad para agregar</span>
            <Icons.chevronsUpDown
              aria-hidden="true"
              className="size-4 shrink-0 text-muted-foreground"
            />
          </Button>
        </PopoverTrigger>
        <PopoverContent
          align="start"
          className="w-(--radix-popover-trigger-width) gap-0 p-0"
          container={fieldRef.current}
        >
          <Command shouldFilter={false}>
            <CommandInput
              aria-label="Buscar Actividad predecesora"
              onValueChange={handleQueryChange}
              placeholder="Buscar Actividad…"
              value={query}
            />
            <CommandList>
              {isLoading ? (
                <p aria-live="polite" className="px-3 py-2 text-sm leading-6 text-muted-foreground">
                  Buscando Actividades…
                </p>
              ) : null}
              {!isLoading && activities.length === 0 ? (
                <CommandEmpty>{emptyMessage}</CommandEmpty>
              ) : null}
              {!isLoading && activities.length > 0 ? (
                <CommandGroup aria-label="Opciones de Actividades predecesoras">
                  {activities.map((activity) => (
                    <CommandItem
                      key={activity.id}
                      onSelect={() => selectActivity(activity)}
                      value={activity.id}
                    >
                      <span className="min-w-0 truncate">{activity.name}</span>
                      <span className="ml-auto shrink-0 text-xs text-muted-foreground">
                        {statusLabel(activity.status)}
                      </span>
                    </CommandItem>
                  ))}
                </CommandGroup>
              ) : null}
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
    </div>
  );
}

>>>>>>> spec-14-dependencias-de-actividades
export function ContainerSearchField({
  containerType,
  error,
  onSelected,
  selectedId,
}: Readonly<{
  containerType: Activity["containerType"];
  error?: string;
  onSelected: (id: string) => void;
  selectedId: string;
}>) {
  const label = containerLabel(containerType);
  const loadOptions = useCallback(
    async (query: string) => {
      if (containerType === "project") {
        const result = await listProjects({ query, status: "all" });
        return result.kind === "success"
          ? {
              kind: "success" as const,
              options: result.data.projects.map((project) => ({
                detail: project.client.name,
                id: project.id,
                label: `${project.code} · ${project.name}`,
              })),
            }
          : result;
      }
      if (containerType === "requirement") {
        const result = await listRequirements({ query, status: "all" });
        return result.kind === "success"
          ? {
              kind: "success" as const,
              options: result.data.requirements.map((requirement) => ({
                detail: requirement.client.name,
                id: requirement.id,
                label: `${requirement.code} · ${requirement.name}`,
              })),
            }
          : result;
      }
      const result = await listTickets({ query, priority: "all" });
      return result.kind === "success"
        ? {
            kind: "success" as const,
            options: result.data.tickets.map((ticket) => ({
              detail: ticket.client.name,
              id: ticket.id,
              label: `${ticket.externalReference} · ${ticket.title}`,
            })),
          }
        : result;
    },
    [containerType],
  );
  return (
    <RemoteSearchField
      emptyMessage={`No hay ${label.toLowerCase()}s que coincidan con la búsqueda.`}
      error={error}
      label={label}
      loadOptions={loadOptions}
      onSelected={onSelected}
      placeholder={`Buscar ${label.toLowerCase()}…`}
      selectedId={selectedId}
    />
  );
}

export function ProjectStageSearchField({
  error,
  onSelected,
  selectedId,
  stages,
}: Readonly<{
  error?: string;
  onSelected: (id: string) => void;
  selectedId: string;
  stages: readonly ProjectStage[];
}>) {
  return (
    <LocalSearchField
      emptyMessage="El Proyecto seleccionado no tiene etapas que coincidan."
      error={error}
      label="Etapa del Proyecto"
      onSelected={onSelected}
      options={stages.map((stage) => ({ id: stage.id, label: stage.name }))}
      placeholder="Buscar etapa…"
      selectedId={selectedId}
    />
  );
}

export function AssigneeSearchField({
  error,
  onSelected,
  selectedId,
  selectedLabel,
}: Readonly<{
  error?: string;
  onSelected: (id: string) => void;
  selectedId: string;
  selectedLabel?: string;
}>) {
  const loadOptions = useCallback(async (query: string) => {
    const result = await listActivityAssignees(query);
    return result.kind === "success"
      ? {
          kind: "success" as const,
          options: result.data.map(assigneeOption),
        }
      : result;
  }, []);
  return (
    <RemoteSearchField
      emptyMessage="No hay responsables que coincidan con la búsqueda."
      error={error}
      label="Responsable"
      loadOptions={loadOptions}
      onSelected={onSelected}
      placeholder="Buscar por nombre o correo…"
      selectedId={selectedId}
      selectedLabel={selectedLabel}
    />
  );
}

function RemoteSearchField({
  emptyMessage,
  error,
  label,
  loadOptions,
  onSelected,
  placeholder,
  selectedId,
  selectedLabel,
}: Readonly<{
  emptyMessage: string;
  error?: string;
  label: string;
  loadOptions: (
    query: string,
  ) => Promise<
    | Readonly<{ kind: "success"; options: readonly SearchOption[] }>
    | Readonly<{ kind: "unauthorized" }>
    | Readonly<{ kind: "conflict" | "validation" | "error"; message: string }>
  >;
  onSelected: (id: string) => void;
  placeholder: string;
  selectedId: string;
  selectedLabel?: string;
}>) {
  const [isOpen, setIsOpen] = useState(false);
  const [options, setOptions] = useState<readonly SearchOption[]>([]);
  const [query, setQuery] = useState("");
  const [state, setState] = useState<SearchState>({ kind: "loading" });

  useEffect(() => {
    if (!isOpen) return;
    let current = true;
    const timeout = window.setTimeout(async () => {
      const result = await loadOptions(query);
      if (!current) return;
      if (result.kind === "success") {
        setOptions(result.options);
        setState({ kind: "ready", options: result.options });
      } else if (result.kind === "unauthorized") setState(result);
      else setState({ kind: "error", message: result.message });
    }, 200);
    return () => {
      current = false;
      window.clearTimeout(timeout);
    };
  }, [isOpen, loadOptions, query]);

  return (
    <SearchField
      emptyMessage={emptyMessage}
      error={error}
      label={label}
      onOpenChange={setIsOpen}
      onSelected={(id) => {
        onSelected(id);
        setIsOpen(false);
        setQuery("");
      }}
      onQueryChange={(value) => {
        setQuery(value);
        setState({ kind: "loading" });
      }}
      open={isOpen}
      options={options}
      placeholder={placeholder}
      query={query}
      selectedId={selectedId}
      selectedLabel={selectedLabel}
      state={state}
    />
  );
}

function LocalSearchField({
  emptyMessage,
  error,
  label,
  onSelected,
  options,
  placeholder,
  selectedId,
}: Readonly<{
  emptyMessage: string;
  error?: string;
  label: string;
  onSelected: (id: string) => void;
  options: readonly SearchOption[];
  placeholder: string;
  selectedId: string;
}>) {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState("");
  const normalizedQuery = query.trim().toLocaleLowerCase();
  const filtered = options.filter((option) =>
    option.label.toLocaleLowerCase().includes(normalizedQuery),
  );
  return (
    <SearchField
      emptyMessage={emptyMessage}
      error={error}
      label={label}
      onOpenChange={setIsOpen}
      onSelected={(id) => {
        onSelected(id);
        setIsOpen(false);
        setQuery("");
      }}
      onQueryChange={setQuery}
      open={isOpen}
      options={filtered}
      placeholder={placeholder}
      query={query}
      selectedId={selectedId}
      state={{ kind: "ready", options: filtered }}
    />
  );
}

function SearchField({
  emptyMessage,
  error,
  label,
  onOpenChange,
  onQueryChange,
  onSelected,
  open,
  options,
  placeholder,
  query,
  selectedId,
  selectedLabel,
  state,
}: Readonly<{
  emptyMessage: string;
  error?: string;
  label: string;
  onOpenChange: (open: boolean) => void;
  onQueryChange: (query: string) => void;
  onSelected: (id: string) => void;
  open: boolean;
  options: readonly SearchOption[];
  placeholder: string;
  query: string;
  selectedId: string;
  selectedLabel?: string;
  state: SearchState;
}>) {
  const fieldRef = useRef<HTMLDivElement>(null);
  const triggerId = useId();
  const selected = options.find((option) => option.id === selectedId);
  return (
    <div className="grid gap-2 text-sm font-medium text-foreground" ref={fieldRef}>
      <Label htmlFor={triggerId}>{label}</Label>
      <Popover onOpenChange={onOpenChange} open={open}>
        <PopoverTrigger asChild>
          <Button
            aria-expanded={open}
            aria-invalid={error ? true : undefined}
            aria-describedby={error ? `${triggerId}-error` : undefined}
            aria-haspopup="listbox"
            className="h-9 w-full justify-between border-input bg-background px-3 text-left font-normal shadow-xs hover:bg-muted/50"
            id={triggerId}
            role="combobox"
            variant="outline"
          >
            <span
              className={selected || selectedLabel ? "truncate" : "truncate text-muted-foreground"}
            >
              {selected?.label ?? selectedLabel ?? `Selecciona ${label.toLocaleLowerCase()}`}
            </span>
            <Icons.chevronsUpDown
              aria-hidden="true"
              className="size-4 shrink-0 text-muted-foreground"
            />
          </Button>
        </PopoverTrigger>
        <PopoverContent
          align="start"
          className="w-(--radix-popover-trigger-width) p-0"
          container={fieldRef.current}
        >
          <Command shouldFilter={false}>
            <CommandInput
              aria-label={`Buscar ${label}`}
              onValueChange={onQueryChange}
              placeholder={placeholder}
              value={query}
            />
            <CommandList>
              {state.kind === "loading" ? (
                <p className="px-3 py-2 text-sm text-muted-foreground">Buscando…</p>
              ) : null}
              {state.kind === "unauthorized" ? (
                <p className="px-3 py-2 text-sm text-danger">
                  No tienes permiso para consultar esta información.
                </p>
              ) : null}
              {state.kind === "error" ? (
                <p className="px-3 py-2 text-sm text-danger">{state.message}</p>
              ) : null}
              {state.kind === "ready" && options.length === 0 ? (
                <CommandEmpty>{emptyMessage}</CommandEmpty>
              ) : null}
              {state.kind === "ready" && options.length ? (
                <CommandGroup aria-label={`Opciones de ${label}`}>
                  {options.map((option) => (
                    <CommandItem
                      key={option.id}
                      onSelect={() => onSelected(option.id)}
                      value={option.id}
                    >
                      <span className="min-w-0 truncate">{option.label}</span>
                      {option.detail ? (
                        <span className="ml-auto truncate pl-3 text-xs text-muted-foreground">
                          {option.detail}
                        </span>
                      ) : null}
                      {option.id === selectedId ? (
                        <Icons.check aria-hidden="true" className="ml-2 shrink-0" />
                      ) : null}
                    </CommandItem>
                  ))}
                </CommandGroup>
              ) : null}
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
      {error ? (
        <p className="text-xs font-normal text-danger" id={`${triggerId}-error`} role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}

function assigneeOption(assignee: ActivityAssignee): SearchOption {
  return { detail: assignee.email, id: assignee.id, label: assignee.name };
}
<<<<<<< HEAD
=======

function statusLabel(status: Activity["status"]): string {
  return status === "blocked"
    ? "Bloqueada"
    : status === "customer_testing"
      ? "Pruebas cliente"
      : status === "finalized"
        ? "Finalizada"
        : status === "in_progress"
          ? "En progreso"
          : status === "in_review"
            ? "En revisión"
            : status === "waiting_third_party"
              ? "Esperando tercero"
              : "Pendiente";
}

>>>>>>> spec-14-dependencias-de-actividades
function containerLabel(type: Activity["containerType"]): string {
  return type === "project" ? "Proyecto" : type === "requirement" ? "Requerimiento" : "Ticket";
}
