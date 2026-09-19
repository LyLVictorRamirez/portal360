import { ClientCodeSettings } from "./client-code-settings";
import { UnauthorizedState } from "../../../../../components/states/interface-states";
import { hasAuthorizationPermission } from "../../../../../lib/authorization";
import { getServerAuthorization } from "../../../../../lib/authorization-context";

export default async function ClientCodeSettingsPage() {
  const authorization = await getServerAuthorization();

  if (!authorization || !hasAuthorizationPermission(authorization, "clients.settings.manage")) {
    return (
      <UnauthorizedState description="No tienes permiso para administrar la configuración de códigos de Clientes." />
    );
  }

  return <ClientCodeSettings />;
}
