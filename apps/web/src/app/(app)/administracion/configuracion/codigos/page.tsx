import { CodeSettingsManagement } from "./code-settings-management";
import { UnauthorizedState } from "../../../../../components/states/interface-states";
import { hasAuthorizationPermission } from "../../../../../lib/authorization";
import { getServerAuthorization } from "../../../../../lib/authorization-context";

export default async function CodeSettingsPage() {
  const authorization = await getServerAuthorization();
  const canManageClientCodes = Boolean(
    authorization && hasAuthorizationPermission(authorization, "clients.settings.manage"),
  );
  const canManageProjectCodes = Boolean(
    authorization && hasAuthorizationPermission(authorization, "projects.settings.manage"),
  );

  if (!canManageClientCodes && !canManageProjectCodes) {
    return (
      <UnauthorizedState description="No tienes permiso para administrar la configuración de códigos." />
    );
  }

  return (
    <CodeSettingsManagement
      canManageClientCodes={canManageClientCodes}
      canManageProjectCodes={canManageProjectCodes}
    />
  );
}
