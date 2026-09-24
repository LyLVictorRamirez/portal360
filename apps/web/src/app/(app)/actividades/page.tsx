import { UnauthorizedState } from "../../../components/states/interface-states";
import { hasAuthorizationPermission } from "../../../lib/authorization";
import { getServerAuthorization } from "../../../lib/authorization-context";
import { ActivityManagement } from "./activity-management";

export default async function ActivitiesPage() {
  const authorization = await getServerAuthorization();

  if (!authorization || !hasAuthorizationPermission(authorization, "activities.read")) {
    return <UnauthorizedState description="No tienes permiso para consultar Actividades." />;
  }

  return (
    <ActivityManagement
      canManageActivities={hasAuthorizationPermission(authorization, "activities.manage")}
    />
  );
}
