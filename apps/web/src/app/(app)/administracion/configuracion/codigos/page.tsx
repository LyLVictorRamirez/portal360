import { CodeSettingsManagement } from "./code-settings-management";
import { getVisibleCodeSettingsEntities } from "./code-settings-access";
import { UnauthorizedState } from "../../../../../components/states/interface-states";
import { getServerAuthorization } from "../../../../../lib/authorization-context";

export default async function CodeSettingsPage() {
  const authorization = await getServerAuthorization();
  const entities = getVisibleCodeSettingsEntities(authorization?.permissions ?? []);

  if (!entities.length) {
    return (
      <UnauthorizedState description="No tienes permiso para administrar la configuración de códigos." />
    );
  }

  return <CodeSettingsManagement entities={entities} />;
}
