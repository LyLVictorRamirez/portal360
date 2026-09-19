import { CodeSettingsSection } from "./code-settings-section";
import { PageHeader } from "../../../../../components/ui/page-header";
import { Surface } from "../../../../../components/ui/surface";

type CodeSettingsManagementProps = Readonly<{
  canManageClientCodes: boolean;
  canManageProjectCodes: boolean;
}>;

export function CodeSettingsManagement({
  canManageClientCodes,
  canManageProjectCodes,
}: CodeSettingsManagementProps) {
  const hasBothSections = canManageClientCodes && canManageProjectCodes;

  return (
    <div className="mx-auto w-full max-w-5xl space-y-8">
      <PageHeader
        description="Define el formato de los códigos que se asignarán a nuevos Clientes y Proyectos. Cada configuración conserva su consecutivo independiente."
        title="Códigos"
      />

      <Surface padding="md" tone="muted">
        <h2 className="text-base font-semibold text-foreground">Alcance de esta configuración</h2>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-muted">
          Los códigos ya emitidos no cambian. Al crear cada registro, el sistema reserva el
          siguiente consecutivo de su entidad para evitar reutilizaciones.
        </p>
      </Surface>

      <div className={hasBothSections ? "grid gap-6 xl:grid-cols-2" : "max-w-3xl"}>
        {canManageClientCodes ? <CodeSettingsSection entity="client" /> : null}
        {canManageProjectCodes ? <CodeSettingsSection entity="project" /> : null}
      </div>
    </div>
  );
}
