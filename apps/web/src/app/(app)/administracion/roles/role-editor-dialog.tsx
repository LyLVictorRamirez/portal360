"use client";

import { useEffect, useState } from "react";

import { Button } from "../../../../components/ui/button";
import { Checkbox } from "../../../../components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "../../../../components/ui/dialog";
import { TextareaField } from "../../../../components/ui/textarea-field";
import { TextField } from "../../../../components/ui/text-field";
import {
  createAuthorizationRole,
  updateAuthorizationRole,
  type AuthorizationApiResult,
  type AuthorizationPermissionDefinition,
  type AuthorizationRoleDetails,
} from "../../../../lib/authorization-roles-client";
import type { AuthorizationPermission } from "../../../../lib/authorization";

type RoleEditorDialogProps = Readonly<{
  onOpenChange: (open: boolean) => void;
  onRoleSaved: (role: AuthorizationRoleDetails) => void;
  open: boolean;
  permissions: AuthorizationPermissionDefinition[];
  role: AuthorizationRoleDetails | null;
}>;

export function RoleEditorDialog({
  onOpenChange,
  onRoleSaved,
  open,
  permissions,
  role,
}: RoleEditorDialogProps) {
  const [description, setDescription] = useState("");
  const [formError, setFormError] = useState<string | null>(null);
  const [isActive, setIsActive] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [key, setKey] = useState("");
  const [name, setName] = useState("");
  const [saveState, setSaveState] =
    useState<AuthorizationApiResult<AuthorizationRoleDetails> | null>(null);
  const [selectedPermissions, setSelectedPermissions] = useState<Set<AuthorizationPermission>>(
    new Set(),
  );

  const isEditing = role !== null;
  const isStandardRole = role?.key === "estandar";
  const canChangeActiveStatus = role?.kind === "custom";

  useEffect(() => {
    if (!open) {
      return;
    }

    setDescription(role?.description ?? "");
    setFormError(null);
    setIsActive(role?.isActive ?? true);
    setIsSaving(false);
    setKey(role?.key ?? "");
    setName(role?.name ?? "");
    setSaveState(null);
    setSelectedPermissions(new Set(role?.permissions ?? []));
  }, [open, role]);

  function togglePermission(permissionKey: AuthorizationPermission) {
    if (isStandardRole && permissionKey === "app.access") {
      return;
    }

    setSelectedPermissions((current) => {
      const next = new Set(current);

      if (next.has(permissionKey)) {
        next.delete(permissionKey);
      } else {
        next.add(permissionKey);
      }

      return next;
    });
    setFormError(null);
    setSaveState(null);
  }

  async function saveRole() {
    const normalizedName = name.trim();
    const normalizedDescription = description.trim();
    const normalizedKey = key.trim();

    if (!normalizedName || !normalizedDescription) {
      setFormError("Completa el nombre y la descripción del rol.");
      return;
    }

    if (!isEditing && !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(normalizedKey)) {
      setFormError("La clave usa minúsculas, números y guiones; por ejemplo, analista-operativo.");
      return;
    }

    const permissionKeys = [...selectedPermissions];

    if (isStandardRole && !permissionKeys.includes("app.access")) {
      permissionKeys.push("app.access");
    }

    permissionKeys.sort();
    setFormError(null);
    setIsSaving(true);
    const result = isEditing
      ? await updateAuthorizationRole(role.key, {
          description: normalizedDescription,
          ...(canChangeActiveStatus ? { isActive } : {}),
          name: normalizedName,
          permissionKeys,
        })
      : await createAuthorizationRole({
          description: normalizedDescription,
          key: normalizedKey,
          name: normalizedName,
          permissionKeys,
        });
    setIsSaving(false);
    setSaveState(result);

    if (result.kind === "success") {
      onRoleSaved(result.data);
      onOpenChange(false);
    }
  }

  const saveError =
    formError ??
    (saveState?.kind === "error"
      ? saveState.message
      : saveState?.kind === "unauthorized"
        ? "Tu sesión ya no permite administrar roles."
        : null);
  const dialogDescription = isEditing
    ? "Actualiza el alcance de este rol. Los cambios se aplican a las personas que ya lo tienen asignado."
    : "Crea un rol personalizado y elige los permisos que aportará a cada persona asignada.";

  return (
    <Dialog onOpenChange={onOpenChange} open={open}>
      <DialogContent className="max-h-[calc(100dvh-2rem)] max-w-xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEditing ? `Editar ${role.name}` : "Crear rol"}</DialogTitle>
          <DialogDescription>{dialogDescription}</DialogDescription>
        </DialogHeader>
        <form
          className="space-y-5"
          onSubmit={(event) => {
            event.preventDefault();
            void saveRole();
          }}
        >
          {!isEditing ? (
            <TextField
              autoComplete="off"
              helpText="La clave es permanente y se usa internamente para asignar el rol."
              label="Clave"
              onChange={(event) => {
                setKey(event.target.value);
                setFormError(null);
              }}
              placeholder="analista-operativo"
              required
              value={key}
            />
          ) : (
            <p className="rounded-md border border-border bg-surface-muted px-3 py-2 text-sm leading-6 text-muted">
              Clave permanente: <code className="font-medium text-foreground">{role.key}</code>
            </p>
          )}

          <TextField
            label="Nombre"
            onChange={(event) => {
              setName(event.target.value);
              setFormError(null);
            }}
            required
            value={name}
          />
          <TextareaField
            label="Descripción"
            onChange={(event) => {
              setDescription(event.target.value);
              setFormError(null);
            }}
            required
            value={description}
          />

          {canChangeActiveStatus ? (
            <label className="flex cursor-pointer items-start gap-3 rounded-md border border-border px-3 py-3 text-sm">
              <Checkbox
                checked={isActive}
                className="mt-0.5"
                onCheckedChange={(checked) => setIsActive(checked === true)}
              />
              <span>
                <span className="font-semibold text-foreground">Rol activo</span>
                <span className="mt-1 block leading-5 text-muted">
                  Los roles inactivos no se pueden asignar y dejan de aportar permisos.
                </span>
              </span>
            </label>
          ) : null}

          <fieldset>
            <legend className="text-sm font-semibold text-foreground">Permisos</legend>
            <p className="mt-1 text-sm leading-6 text-muted">
              Selecciona el alcance que este rol añadirá. Los permisos de varios roles se acumulan.
            </p>
            <div className="mt-4 space-y-2">
              {permissions.map((permission) => {
                const isRequired = isStandardRole && permission.key === "app.access";

                return (
                  <label
                    className="flex cursor-pointer items-start gap-3 rounded-md border border-border px-3 py-3 text-sm hover:border-border-strong"
                    key={permission.key}
                  >
                    <Checkbox
                      checked={selectedPermissions.has(permission.key)}
                      className="mt-0.5"
                      disabled={isRequired}
                      onCheckedChange={() => togglePermission(permission.key)}
                    />
                    <span>
                      <span className="font-semibold text-foreground">{permission.name}</span>
                      {isRequired ? (
                        <span className="ml-2 text-xs font-medium text-muted">Obligatorio</span>
                      ) : null}
                      <span className="mt-1 block leading-5 text-muted">
                        {permission.description}
                      </span>
                      <code className="mt-1 block text-xs text-muted">{permission.key}</code>
                    </span>
                  </label>
                );
              })}
            </div>
          </fieldset>

          {saveError ? (
            <p role="alert" className="text-sm leading-6 text-danger">
              {saveError}
            </p>
          ) : null}

          <div className="flex flex-col-reverse gap-2 border-t border-border pt-4 sm:flex-row sm:justify-end">
            <Button onClick={() => onOpenChange(false)} variant="ghost">
              Cancelar
            </Button>
            <Button disabled={isSaving} type="submit">
              {isSaving ? "Guardando…" : isEditing ? "Guardar cambios" : "Crear rol"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
