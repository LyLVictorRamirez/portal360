import { UnauthorizedState } from "../../../components/states/interface-states";
import { hasAuthorizationPermission } from "../../../lib/authorization";
import { getServerAuthorization } from "../../../lib/authorization-context";
import { TicketManagement } from "./ticket-management";

export default async function TicketsPage() {
  const authorization = await getServerAuthorization();

  if (!authorization || !hasAuthorizationPermission(authorization, "tickets.read")) {
    return <UnauthorizedState description="No tienes permiso para consultar Tickets." />;
  }

  return (
    <TicketManagement
      canManageTickets={hasAuthorizationPermission(authorization, "tickets.manage")}
    />
  );
}
