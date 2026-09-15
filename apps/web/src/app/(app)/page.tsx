import { PageHeader } from "../../components/ui/page-header";

export default function HomePage() {
  return (
    <div className="mx-auto w-full max-w-6xl">
      <PageHeader
        description="Punto de partida para el trabajo operativo del equipo."
        title="Inicio"
      />
      <section className="max-w-2xl py-10">
        <p className="text-sm leading-6 text-muted">
          Las áreas de trabajo se incorporarán a medida que se definan los procesos del portal.
        </p>
      </section>
    </div>
  );
}
