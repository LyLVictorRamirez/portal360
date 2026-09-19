import { UserManagement } from "./user-management";
import { UnauthorizedState } from "../../../../components/states/interface-states";
import { getServerAuthorization } from "../../../../lib/authorization-context";
import { hasAuthorizationPermission } from "../../../../lib/authorization";

export default async function UsersAdministrationPage() {
  const authorization = await getServerAuthorization();

  if (!authorization || !hasAuthorizationPermission(authorization, "authorization.users.read")) {
    return (
      <UnauthorizedState description="No tienes permiso para consultar la administración de usuarios." />
    );
  }

  return (
    <UserManagement
      canManageUsers={hasAuthorizationPermission(authorization, "authorization.users.manage")}
    />
  );
}
