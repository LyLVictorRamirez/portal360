import { ProjectManagement } from "./project-management";
import { UnauthorizedState } from "../../../components/states/interface-states";
import { hasAuthorizationPermission } from "../../../lib/authorization";
import { getServerAuthorization } from "../../../lib/authorization-context";

export default async function ProjectsPage() {
  const authorization = await getServerAuthorization();

  if (!authorization || !hasAuthorizationPermission(authorization, "projects.read")) {
    return <UnauthorizedState description="No tienes permiso para consultar Proyectos." />;
  }

  return (
    <ProjectManagement
      canManageProjects={hasAuthorizationPermission(authorization, "projects.manage")}
    />
  );
}
