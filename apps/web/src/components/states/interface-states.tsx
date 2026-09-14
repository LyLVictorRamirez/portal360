import type { ReactNode } from "react";
import {
  Inbox,
  LoaderCircle,
  SearchX,
  ShieldOff,
  TriangleAlert,
  type LucideIcon,
} from "lucide-react";

type InterfaceStateProps = {
  action?: ReactNode;
  description: string;
  icon: LucideIcon;
  isLoading?: boolean;
  title: string;
  tone?: "default" | "danger";
};

type StateOverrides = Partial<Pick<InterfaceStateProps, "action" | "description" | "title">>;

function InterfaceState({
  action,
  description,
  icon: Icon,
  isLoading = false,
  title,
  tone = "default",
}: InterfaceStateProps) {
  const iconClassName = tone === "danger" ? "text-danger" : "text-muted";

  return (
    <section className="flex min-h-64 flex-col items-center justify-center px-6 py-12 text-center">
      <div
        className={`flex size-10 items-center justify-center rounded-md bg-surface-muted ${iconClassName}`}
      >
        <Icon
          aria-hidden="true"
          className={isLoading ? "animate-spin" : undefined}
          size={20}
          strokeWidth={1.75}
        />
      </div>
      <h2 className="mt-4 text-base font-semibold text-foreground">{title}</h2>
      <p className="mt-1 max-w-md text-sm leading-6 text-muted">{description}</p>
      {action ? <div className="mt-5">{action}</div> : null}
    </section>
  );
}

export function LoadingState({
  description = "Estamos preparando la información.",
  title = "Cargando",
}: StateOverrides) {
  return <InterfaceState description={description} icon={LoaderCircle} isLoading title={title} />;
}

export function EmptyState({
  action,
  description = "Aún no hay información para mostrar.",
  title = "No hay resultados",
}: StateOverrides) {
  return <InterfaceState action={action} description={description} icon={Inbox} title={title} />;
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
      icon={TriangleAlert}
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
    <InterfaceState action={action} description={description} icon={ShieldOff} title={title} />
  );
}

export function NotFoundState({
  action,
  description = "La dirección que buscas no existe o ya no está disponible.",
  title = "Página no encontrada",
}: StateOverrides) {
  return <InterfaceState action={action} description={description} icon={SearchX} title={title} />;
}
