"use client";

import { ChevronDown } from "lucide-react";
import {
  useEffect,
  useId,
  useRef,
  useState,
  type FocusEvent as ReactFocusEvent,
  type KeyboardEvent as ReactKeyboardEvent,
} from "react";

import { FieldLabel } from "../../../components/ui/field-label";
import { listClients, type Client } from "../../../lib/clients-client";

type ClientSearchState =
  | Readonly<{ kind: "loading" }>
  | Readonly<{ clients: readonly Client[]; kind: "ready"; total: number }>
  | Readonly<{ kind: "unauthorized" }>
  | Readonly<{ kind: "error"; message: string }>;

type ClientSearchFieldProps = Readonly<{
  disabled: boolean;
  onSelectedClientChange: (client: Client | null) => void;
  selectedClient: Client | null;
}>;

export function ClientSearchField({
  disabled,
  onSelectedClientChange,
  selectedClient,
}: ClientSearchFieldProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [state, setState] = useState<ClientSearchState>({ kind: "loading" });
  const labelId = useId();
  const listboxId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const triggerId = useId();

  useEffect(() => {
    let current = true;
    const timeout = window.setTimeout(async () => {
      const result = await listClients({ query, status: "active" });

      if (!current) {
        return;
      }

      if (result.kind === "success") {
        setState({
          clients: result.data.clients,
          kind: "ready",
          total: result.data.total,
        });
        return;
      }

      setState(
        result.kind === "unauthorized" ? result : { kind: "error", message: result.message },
      );
    }, 200);

    return () => {
      current = false;
      window.clearTimeout(timeout);
    };
  }, [query]);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    const animationFrame = window.requestAnimationFrame(() => {
      searchInputRef.current?.focus({ preventScroll: true });
    });

    return () => window.cancelAnimationFrame(animationFrame);
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    function handlePointerDown(event: PointerEvent) {
      const root = rootRef.current;

      if (!root || !(event.target instanceof Node) || root.contains(event.target)) {
        return;
      }

      setIsOpen(false);
    }

    document.addEventListener("pointerdown", handlePointerDown);

    return () => document.removeEventListener("pointerdown", handlePointerDown);
  }, [isOpen]);

  const clients = state.kind === "ready" ? state.clients : [];

  function getOptions() {
    return Array.from(
      rootRef.current?.querySelectorAll<HTMLButtonElement>('button[role="option"]') ?? [],
    );
  }

  function focusOption(position: "first" | "last" | number) {
    const options = getOptions();

    if (options.length === 0) {
      return;
    }

    const index = position === "first" ? 0 : position === "last" ? options.length - 1 : position;

    options.at((index + options.length) % options.length)?.focus({ preventScroll: true });
  }

  function closePicker(restoreFocus = false) {
    setIsOpen(false);

    if (restoreFocus) {
      window.requestAnimationFrame(() => triggerRef.current?.focus({ preventScroll: true }));
    }
  }

  function selectClient(client: Client) {
    onSelectedClientChange(client);
    setQuery("");
    setState({ kind: "loading" });
    closePicker(true);
  }

  function handleTriggerKeyDown(event: ReactKeyboardEvent<HTMLButtonElement>) {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setIsOpen(true);
    }
  }

  function handleRootBlur(event: ReactFocusEvent<HTMLDivElement>) {
    const nextFocusedElement = event.relatedTarget;

    if (nextFocusedElement instanceof Node && rootRef.current?.contains(nextFocusedElement)) {
      return;
    }

    setIsOpen(false);
  }

  function handleSearchKeyDown(event: ReactKeyboardEvent<HTMLInputElement>) {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      focusOption("first");
    }
  }

  function handleOptionKeyDown(event: ReactKeyboardEvent<HTMLButtonElement>) {
    const options = getOptions();
    const currentIndex = options.indexOf(event.currentTarget);

    if (event.key === "ArrowDown") {
      event.preventDefault();
      focusOption(currentIndex + 1);
      return;
    }

    if (event.key === "ArrowUp") {
      event.preventDefault();
      focusOption(currentIndex - 1);
      return;
    }

    if (event.key === "Home") {
      event.preventDefault();
      focusOption("first");
      return;
    }

    if (event.key === "End") {
      event.preventDefault();
      focusOption("last");
    }
  }

  return (
    <div className="space-y-1.5" onBlur={handleRootBlur} ref={rootRef}>
      <FieldLabel id={labelId} htmlFor={triggerId}>
        Cliente
      </FieldLabel>
      <div className="relative">
        <button
          aria-controls={isOpen ? listboxId : undefined}
          aria-expanded={isOpen}
          aria-haspopup="listbox"
          aria-labelledby={labelId}
          className="flex h-10 w-full items-center justify-between gap-3 rounded-md border border-border bg-surface px-3 text-left text-sm text-foreground transition-colors duration-150 hover:border-border-strong focus:border-primary disabled:cursor-not-allowed disabled:bg-surface-muted disabled:text-muted"
          disabled={disabled}
          id={triggerId}
          onClick={() => setIsOpen((open) => !open)}
          onKeyDown={handleTriggerKeyDown}
          ref={triggerRef}
          role="combobox"
          type="button"
        >
          <span className={selectedClient ? "truncate" : "truncate text-muted"}>
            {selectedClient
              ? `${selectedClient.code} · ${selectedClient.name}`
              : "Selecciona un Cliente"}
          </span>
          <ChevronDown
            aria-hidden="true"
            className={[
              "size-4 shrink-0 text-muted transition-transform duration-150",
              isOpen ? "rotate-180" : "",
            ]
              .filter(Boolean)
              .join(" ")}
          />
        </button>

        {isOpen ? (
          <div className="absolute z-50 mt-1 w-full overflow-hidden rounded-md border border-border bg-surface p-2 shadow-md">
            <input
              aria-controls={listboxId}
              aria-label="Buscar Cliente"
              autoComplete="off"
              className="h-10 w-full rounded-sm border border-border bg-surface px-3 text-sm text-foreground outline-none placeholder:text-muted focus:border-primary"
              disabled={disabled}
              onChange={(event) => {
                setQuery(event.target.value);
                setState({ kind: "loading" });
              }}
              onKeyDown={handleSearchKeyDown}
              placeholder="Buscar Cliente…"
              ref={searchInputRef}
              type="search"
              value={query}
            />

            {state.kind === "loading" ? (
              <p aria-live="polite" className="px-3 py-2 text-sm leading-6 text-muted">
                Buscando Clientes…
              </p>
            ) : null}
            {state.kind === "unauthorized" ? (
              <p className="px-3 py-2 text-sm leading-6 text-danger" role="alert">
                Tu sesión no permite consultar los Clientes.
              </p>
            ) : null}
            {state.kind === "error" ? (
              <p className="px-3 py-2 text-sm leading-6 text-danger" role="alert">
                No fue posible buscar Clientes: {state.message}
              </p>
            ) : null}
            {state.kind === "ready" && clients.length === 0 ? (
              <p aria-live="polite" className="px-3 py-2 text-sm leading-6 text-muted">
                No hay Clientes activos que coincidan con la búsqueda.
              </p>
            ) : null}
            {state.kind === "ready" && clients.length > 0 ? (
              <ul
                aria-label="Opciones de Clientes"
                className="mt-1 max-h-56 overflow-y-auto"
                id={listboxId}
                role="listbox"
              >
                {clients.map((client) => (
                  <li key={client.id} role="none">
                    <button
                      aria-selected={client.id === selectedClient?.id}
                      className="flex w-full items-center rounded-sm px-3 py-2 text-left text-sm leading-5 text-foreground transition-colors hover:bg-surface-muted focus:bg-surface-muted focus:outline-none"
                      onClick={() => selectClient(client)}
                      onKeyDown={handleOptionKeyDown}
                      role="option"
                      type="button"
                    >
                      <span className="min-w-0 truncate">{client.name}</span>
                      <span className="ml-3 shrink-0 font-mono text-xs text-muted">
                        {client.code}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            ) : null}
            {state.kind === "ready" && state.total > clients.length ? (
              <p className="border-t border-border px-3 py-2 text-xs leading-5 text-muted">
                Escribe una búsqueda más específica para encontrar otro Cliente.
              </p>
            ) : null}
          </div>
        ) : null}
      </div>
    </div>
  );
}
