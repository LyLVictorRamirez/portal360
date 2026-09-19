"use client";

import { useEffect, useMemo, useState } from "react";

import { Button } from "../../../../../components/ui/button";
import {
  ErrorState,
  LoadingState,
  UnauthorizedState,
} from "../../../../../components/states/interface-states";
import { PageHeader } from "../../../../../components/ui/page-header";
import { Surface } from "../../../../../components/ui/surface";
import { TextField } from "../../../../../components/ui/text-field";
import {
  getClientCodeSettings,
  type ClientCodeSettings as ClientCodeSettingsValue,
  updateClientCodeSettings,
} from "../../../../../lib/clients-client";

type SettingsState =
  | Readonly<{ kind: "loading" }>
  | Readonly<{ kind: "ready"; settings: ClientCodeSettingsValue }>
  | Readonly<{ kind: "unauthorized" }>
  | Readonly<{ kind: "error"; message: string }>;

type SettingsDraft = Readonly<{
  codeLength: string;
  nextSequence: string;
  prefix: string;
}>;

const emptyDraft: SettingsDraft = {
  codeLength: "",
  nextSequence: "",
  prefix: "",
};

export function ClientCodeSettings() {
  const [draft, setDraft] = useState<SettingsDraft>(emptyDraft);
  const [formError, setFormError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [state, setState] = useState<SettingsState>({ kind: "loading" });

  useEffect(() => {
    let current = true;
    setState({ kind: "loading" });
    setFormError(null);

    void getClientCodeSettings().then((result) => {
      if (!current) {
        return;
      }

      if (result.kind === "success") {
        setState({ kind: "ready", settings: result.data });
        setDraft(toDraft(result.data));
        return;
      }

      if (result.kind === "unauthorized") {
        setState({ kind: "unauthorized" });
        return;
      }

      setState({ kind: "error", message: result.message });
    });

    return () => {
      current = false;
    };
  }, [reloadKey]);

  const preview = useMemo(() => createPreview(draft), [draft]);
  const settings = state.kind === "ready" ? state.settings : null;

  function reload() {
    setSaveMessage(null);
    setReloadKey((value) => value + 1);
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!settings || saving) {
      return;
    }

    const normalizedDraft = normalizeDraft(draft);
    const validationError = validateDraft(normalizedDraft);

    if (validationError) {
      setFormError(validationError);
      return;
    }

    setSaving(true);
    setFormError(null);
    setSaveMessage(null);

    const result = await updateClientCodeSettings({
      codeLength: Number(normalizedDraft.codeLength),
      nextSequence: normalizedDraft.nextSequence,
      prefix: normalizedDraft.prefix,
      version: settings.version,
    });

    setSaving(false);

    if (result.kind === "success") {
      setState({ kind: "ready", settings: result.data });
      setDraft(toDraft(result.data));
      setSaveMessage("Se actualizó la configuración para los próximos Clientes.");
      return;
    }

    if (result.kind === "unauthorized") {
      setState({ kind: "unauthorized" });
      return;
    }

    if (result.kind === "conflict") {
      setFormError(`${result.message} Recarga la configuración antes de volver a guardar.`);
      return;
    }

    setFormError(result.message);
  }

  return (
    <div className="mx-auto w-full max-w-3xl space-y-8">
      <PageHeader
        description="Define cómo se asignan los códigos a los Clientes que se creen a partir de ahora."
        title="Códigos de Clientes"
      />

      <Surface aria-labelledby="client-code-rules-title" padding="md" tone="muted">
        <h2 className="text-base font-semibold text-foreground" id="client-code-rules-title">
          Alcance de esta configuración
        </h2>
        <p className="mt-2 text-sm leading-6 text-muted">
          Los códigos ya emitidos no cambian. El siguiente código se reserva al crear cada Cliente,
          por lo que no se reutilizan consecutivos.
        </p>
      </Surface>

      {state.kind === "loading" ? (
        <LoadingState title="Consultando la configuración de códigos" />
      ) : null}
      {state.kind === "unauthorized" ? <UnauthorizedState /> : null}
      {state.kind === "error" ? (
        <ErrorState
          action={<Button onClick={reload}>Reintentar</Button>}
          description={state.message}
          title="No fue posible consultar la configuración"
        />
      ) : null}
      {settings ? (
        <section aria-labelledby="client-code-form-title" className="space-y-5">
          <div>
            <h2
              className="text-xl font-semibold tracking-tight text-foreground"
              id="client-code-form-title"
            >
              Formato para nuevos Clientes
            </h2>
            <p className="mt-1.5 text-sm leading-6 text-muted">
              El código se compone del prefijo, un guion y un consecutivo con ceros a la izquierda.
            </p>
          </div>

          <form className="space-y-6" onSubmit={handleSubmit} noValidate>
            <div className="grid gap-5 sm:grid-cols-2">
              <TextField
                autoCapitalize="characters"
                autoComplete="off"
                disabled={saving}
                helpText="De 1 a 10 caracteres alfanuméricos en mayúscula."
                label="Prefijo"
                maxLength={10}
                onChange={(event) => {
                  setDraft((current) => ({
                    ...current,
                    prefix: event.target.value.toUpperCase(),
                  }));
                }}
                required
                value={draft.prefix}
              />
              <TextField
                disabled={saving}
                helpText="De 3 a 20; no cuenta el guion."
                inputMode="numeric"
                label="Longitud total"
                max="20"
                min="3"
                onChange={(event) => {
                  setDraft((current) => ({ ...current, codeLength: event.target.value }));
                }}
                required
                type="number"
                value={draft.codeLength}
              />
              <TextField
                className="sm:col-span-2"
                disabled={saving}
                helpText="No puede disminuir ni reutilizar un consecutivo ya reservado."
                inputMode="numeric"
                label="Siguiente consecutivo"
                onChange={(event) => {
                  setDraft((current) => ({ ...current, nextSequence: event.target.value }));
                }}
                required
                value={draft.nextSequence}
              />
            </div>

            <Surface aria-live="polite" padding="md">
              <p className="text-xs font-semibold uppercase tracking-[0.12em] text-muted">
                Próximo código
              </p>
              <p className="mt-2 font-mono text-2xl font-semibold tracking-tight text-foreground">
                {preview}
              </p>
            </Surface>

            {formError ? (
              <p aria-live="assertive" className="text-sm font-medium text-danger" role="alert">
                {formError}
              </p>
            ) : null}
            {saveMessage ? (
              <p aria-live="polite" className="text-sm font-medium text-success">
                {saveMessage}
              </p>
            ) : null}

            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border pt-5">
              <Button disabled={saving} onClick={reload} type="button" variant="secondary">
                Recargar configuración
              </Button>
              <Button disabled={saving} type="submit">
                {saving ? "Guardando…" : "Guardar configuración"}
              </Button>
            </div>
          </form>
        </section>
      ) : null}
    </div>
  );
}

function toDraft(settings: ClientCodeSettingsValue): SettingsDraft {
  return {
    codeLength: String(settings.codeLength),
    nextSequence: settings.nextSequence,
    prefix: settings.prefix,
  };
}

function normalizeDraft(draft: SettingsDraft): SettingsDraft {
  return {
    codeLength: draft.codeLength.trim(),
    nextSequence: draft.nextSequence.trim(),
    prefix: draft.prefix.trim().toUpperCase(),
  };
}

function validateDraft(draft: SettingsDraft): string | null {
  if (!/^[A-Z0-9]{1,10}$/.test(draft.prefix)) {
    return "El prefijo debe tener de 1 a 10 caracteres alfanuméricos en mayúscula.";
  }

  if (!/^\d+$/.test(draft.codeLength)) {
    return "La longitud total debe ser un número entero entre 3 y 20.";
  }

  const codeLength = Number(draft.codeLength);

  if (codeLength < 3 || codeLength > 20) {
    return "La longitud total debe estar entre 3 y 20.";
  }

  if (draft.prefix.length >= codeLength) {
    return "La longitud total debe dejar al menos un dígito para el consecutivo.";
  }

  if (!/^\d+$/.test(draft.nextSequence) || BigInt(draft.nextSequence) < BigInt(1)) {
    return "El siguiente consecutivo debe ser un número entero positivo.";
  }

  if (draft.nextSequence.length > codeLength - draft.prefix.length) {
    return "El siguiente consecutivo no cabe en la longitud configurada.";
  }

  return null;
}

function createPreview(draft: SettingsDraft): string {
  const normalizedDraft = normalizeDraft(draft);

  if (!normalizedDraft.prefix || !/^\d+$/.test(normalizedDraft.codeLength)) {
    return "—";
  }

  const consecutiveDigits = Number(normalizedDraft.codeLength) - normalizedDraft.prefix.length;

  if (consecutiveDigits < 1 || !/^\d+$/.test(normalizedDraft.nextSequence)) {
    return "—";
  }

  return `${normalizedDraft.prefix}-${normalizedDraft.nextSequence.padStart(consecutiveDigits, "0")}`;
}
