import { ActivityCategoryManagement } from "./activity-category-management";
import { UnauthorizedState } from "../../../../components/states/interface-states";
import { hasAuthorizationPermission } from "../../../../lib/authorization";
import { getServerAuthorization } from "../../../../lib/authorization-context";

export default async function ActivityCategoriesAdministrationPage() {
  const authorization = await getServerAuthorization();

  if (!authorization || !hasAuthorizationPermission(authorization, "activity-categories.manage")) {
    return (
      <UnauthorizedState description="No tienes permiso para administrar las categorías de Actividad." />
    );
  }

  return <ActivityCategoryManagement />;
}
