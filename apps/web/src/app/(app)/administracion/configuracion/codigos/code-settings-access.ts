import type { AuthorizationPermission } from "../../../../../lib/authorization";

export const codeSettingsEntities = ["client", "project", "requirement"] as const;

export type CodeSettingsEntity = (typeof codeSettingsEntities)[number];

const codeSettingsPermissions = {
  client: "clients.settings.manage",
  project: "projects.settings.manage",
  requirement: "requirements.settings.manage",
} as const satisfies Record<CodeSettingsEntity, AuthorizationPermission>;

export function getVisibleCodeSettingsEntities(
  permissions: readonly AuthorizationPermission[],
): readonly CodeSettingsEntity[] {
  return codeSettingsEntities.filter((entity) =>
    permissions.includes(codeSettingsPermissions[entity]),
  );
}
