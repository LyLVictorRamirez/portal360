import { ClientManagement } from "./client-management";
import { UnauthorizedState } from "../../../components/states/interface-states";
import { hasAuthorizationPermission } from "../../../lib/authorization";
import { getServerAuthorization } from "../../../lib/authorization-context";

export default async function ClientsPage() {
  const authorization = await getServerAuthorization();

  if (!authorization || !hasAuthorizationPermission(authorization, "clients.read")) {
    return <UnauthorizedState description="No tienes permiso para consultar Clientes." />;
  }

  return <ClientManagement canManageClients={hasAuthorizationPermission(authorization, "clients.manage")} />;
}
