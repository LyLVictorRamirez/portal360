import { RoleManagement } from "./role-management";
import { UnauthorizedState } from "../../../../components/states/interface-states";
import { hasAuthorizationPermission } from "../../../../lib/authorization";
import { getServerAuthorization } from "../../../../lib/authorization-context";

export default async function RolesAdministrationPage() {
  const authorization = await getServerAuthorization();

  if (!authorization || !hasAuthorizationPermission(authorization, "authorization.roles.read")) {
    return (
      <UnauthorizedState description="No tienes permiso para consultar la administración de roles." />
    );
  }

  return (
    <RoleManagement
      canManageRoles={hasAuthorizationPermission(authorization, "authorization.roles.manage")}
    />
  );
}
