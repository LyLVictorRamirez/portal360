import { RequirementManagement } from "./requirement-management";
import { UnauthorizedState } from "../../../components/states/interface-states";
import { hasAuthorizationPermission } from "../../../lib/authorization";
import { getServerAuthorization } from "../../../lib/authorization-context";

export default async function RequirementsPage() {
  const authorization = await getServerAuthorization();

  if (!authorization || !hasAuthorizationPermission(authorization, "requirements.read")) {
    return <UnauthorizedState description="No tienes permiso para consultar Requerimientos." />;
  }

  return (
    <RequirementManagement
      canManageRequirements={hasAuthorizationPermission(authorization, "requirements.manage")}
    />
  );
}
