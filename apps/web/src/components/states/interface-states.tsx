import { useId, type ReactNode } from "react";

import { Icons, type Icon } from "../icons";

type InterfaceStateTone = "default" | "danger" | "warning";
type StateHeadingLevel = "h1" | "h2";

type InterfaceStateProps = Readonly<{
  action?: ReactNode;
  description: string;
  headingLevel?: StateHeadingLevel;
  icon: Icon;
  isLoading?: boolean;
  title: string;
  tone?: InterfaceStateTone;
}>;

type StateOverrides = Readonly<
  Partial<Pick<InterfaceStateProps, "action" | "description" | "title">>
>;

const iconClassNames: Record<InterfaceStateTone, string> = {
  default: "border-primary bg-surface-selected text-primary",
  danger: "border-danger bg-danger-surface text-danger",
  warning: "border-warning bg-warning-surface text-warning-foreground",
};

function InterfaceState({
  action,
  description,
  headingLevel = "h2",
  icon: Icon,
  isLoading = false,
  title,
  tone = "default",
}: InterfaceStateProps) {
  const Heading = headingLevel;
  const titleId = useId();
  const role = isLoading ? "status" : tone === "danger" ? "alert" : undefined;

  return (
    <section
      aria-busy={isLoading || undefined}
      aria-live={isLoading ? "polite" : undefined}
      aria-labelledby={titleId}
      className="flex min-h-64 items-center border-y border-border bg-surface px-6 py-12"
      role={role}
    >
      <div className="mx-auto max-w-lg text-center">
        <div
          className={`mx-auto flex size-12 items-center justify-center rounded-md border ${
            iconClassNames[tone]
          }`}
        >
          <Icon
            aria-hidden="true"
            className={isLoading ? "motion-safe:animate-spin" : undefined}
            size={24}
            strokeWidth={1.75}
          />
        </div>
        <Heading className="mt-5 text-xl font-semibold tracking-tight text-foreground" id={titleId}>
          {title}
        </Heading>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">{description}</p>
        {action ? <div className="mt-6 flex justify-center">{action}</div> : null}
      </div>
    </section>
  );
}

export function LoadingState({
  description = "Estamos preparando la información.",
  title = "Cargando",
}: StateOverrides) {
  return <InterfaceState description={description} icon={Icons.spinner} isLoading title={title} />;
}

export function EmptyState({
  action,
  description = "Aún no hay información para mostrar.",
  title = "No hay resultados",
}: StateOverrides) {
  return (
    <InterfaceState
      action={action}
      description={description}
      icon={Icons.workspace}
      title={title}
    />
  );
}

export function ErrorState({
  action,
  description = "No fue posible cargar la información. Inténtalo de nuevo.",
  title = "Ocurrió un problema",
}: StateOverrides) {
  return (
    <InterfaceState
      action={action}
      description={description}
      icon={Icons.warning}
      title={title}
      tone="danger"
    />
  );
}

export function UnauthorizedState({
  action,
  description = "No tienes permiso para acceder a este contenido.",
  title = "Acceso no autorizado",
}: StateOverrides) {
  return (
    <InterfaceState
      action={action}
      description={description}
      icon={Icons.lock}
      title={title}
      tone="warning"
    />
  );
}

export function NotFoundState({
  action,
  description = "La dirección que buscas no existe o ya no está disponible.",
  title = "Página no encontrada",
}: StateOverrides) {
  return (
    <InterfaceState
      action={action}
      description={description}
      headingLevel="h1"
      icon={Icons.search}
      title={title}
    />
  );
}
