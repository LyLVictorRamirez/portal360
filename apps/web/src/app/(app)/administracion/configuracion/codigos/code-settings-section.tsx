"use client";

import { useEffect, useMemo, useState, type FormEvent } from "react";

import type { CodeSettingsEntity } from "./code-settings-access";
import { Button } from "../../../../../components/ui/button";
import {
  ErrorState,
  LoadingState,
  UnauthorizedState,
} from "../../../../../components/states/interface-states";
import { Surface } from "../../../../../components/ui/surface";
import { TextField } from "../../../../../components/ui/text-field";
import { getClientCodeSettings, updateClientCodeSettings } from "../../../../../lib/clients-client";
import {
  getProjectCodeSettings,
  updateProjectCodeSettings,
} from "../../../../../lib/projects-client";
import {
  getRequirementCodeSettings,
  updateRequirementCodeSettings,
} from "../../../../../lib/requirements-client";

type CodeSettings = Readonly<{
  codeLength: number;
  nextSequence: string;
  prefix: string;
  version: number;
}>;

type CodeSettingsResult =
  | Readonly<{ data: CodeSettings; kind: "success" }>
  | Readonly<{ kind: "unauthorized" }>
  | Readonly<{ kind: "conflict"; message: string }>
  | Readonly<{ kind: "validation"; message: string }>
  | Readonly<{ kind: "error"; message: string }>;

type SettingsState =
  | Readonly<{ kind: "loading" }>
  | Readonly<{ kind: "ready"; settings: CodeSettings }>
  | Readonly<{ kind: "unauthorized" }>
  | Readonly<{ kind: "error"; message: string }>;

type SettingsDraft = Readonly<{
  codeLength: string;
  nextSequence: string;
  prefix: string;
}>;

type CodeSettingsSectionProps = Readonly<{
  entity: CodeSettingsEntity;
}>;

const emptyDraft: SettingsDraft = {
  codeLength: "",
  nextSequence: "",
  prefix: "",
};

const entityContent: Record<
  CodeSettingsEntity,
  Readonly<{
    formTitle: string;
    loadTitle: string;
    plural: string;
    singular: string;
  }>
> = {
  client: {
    formTitle: "Formato para nuevos Clientes",
    loadTitle: "Consultando códigos de Clientes",
    plural: "Clientes",
    singular: "Cliente",
  },
  project: {
    formTitle: "Formato para nuevos Proyectos",
    loadTitle: "Consultando códigos de Proyectos",
    plural: "Proyectos",
    singular: "Proyecto",
  },
  requirement: {
    formTitle: "Formato para nuevos Requerimientos",
    loadTitle: "Consultando códigos de Requerimientos",
    plural: "Requerimientos",
    singular: "Requerimiento",
  },
};

export function CodeSettingsSection({ entity }: CodeSettingsSectionProps) {
  const content = entityContent[entity];
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

    void getCodeSettings(entity).then((result) => {
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
  }, [entity, reloadKey]);

  const preview = useMemo(() => createPreview(draft), [draft]);
  const settings = state.kind === "ready" ? state.settings : null;

  function reload() {
    setSaveMessage(null);
    setReloadKey((value) => value + 1);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
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

    const result = await updateCodeSettings(entity, {
      codeLength: Number(normalizedDraft.codeLength),
      nextSequence: normalizedDraft.nextSequence,
      prefix: normalizedDraft.prefix,
      version: settings.version,
    });

    setSaving(false);

    if (result.kind === "success") {
      setState({ kind: "ready", settings: result.data });
      setDraft(toDraft(result.data));
      setSaveMessage(`Se actualizó la configuración para los próximos ${content.plural}.`);
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
    <section aria-labelledby={`${entity}-code-form-title`}>
      <Surface padding="md" tone="raised">
        <div>
          <h2
            className="text-xl font-semibold tracking-tight text-foreground"
            id={`${entity}-code-form-title`}
          >
            {content.formTitle}
          </h2>
          <p className="mt-1.5 text-sm leading-6 text-muted">
            El código combina un prefijo, un guion y un consecutivo con ceros a la izquierda.
          </p>
        </div>

        <div className="mt-6">
          {state.kind === "loading" ? <LoadingState title={content.loadTitle} /> : null}
          {state.kind === "unauthorized" ? (
            <UnauthorizedState
              description={`Tu sesión ya no permite consultar los códigos de ${content.plural}.`}
            />
          ) : null}
          {state.kind === "error" ? (
            <ErrorState
              action={<Button onClick={reload}>Reintentar</Button>}
              description={state.message}
              title={`No fue posible consultar los códigos de ${content.plural}`}
            />
          ) : null}
          {settings ? (
            <form className="space-y-6" noValidate onSubmit={handleSubmit}>
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

              <Surface aria-live="polite" padding="md" tone="muted">
                <p className="text-sm font-semibold text-muted">
                  Próximo código de {content.singular}
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
          ) : null}
        </div>
      </Surface>
    </section>
  );
}

async function getCodeSettings(entity: CodeSettingsEntity): Promise<CodeSettingsResult> {
  switch (entity) {
    case "client":
      return getClientCodeSettings();
    case "project":
      return getProjectCodeSettings();
    case "requirement":
      return getRequirementCodeSettings();
  }
}

async function updateCodeSettings(
  entity: CodeSettingsEntity,
  input: CodeSettings,
): Promise<CodeSettingsResult> {
  switch (entity) {
    case "client":
      return updateClientCodeSettings(input);
    case "project":
      return updateProjectCodeSettings(input);
    case "requirement":
      return updateRequirementCodeSettings(input);
  }
}

function toDraft(settings: CodeSettings): SettingsDraft {
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
