import { Portal360Mark } from "../../../components/ui/portal-360-mark";
import { Surface } from "../../../components/ui/surface";

export default function LoginPage() {
  return (
    <main className="min-h-screen bg-canvas px-6 py-8 lg:px-10 lg:py-10">
      <div className="mx-auto grid min-h-[calc(100vh-4rem)] max-w-6xl items-center gap-10 lg:grid-cols-[minmax(0,1fr)_26rem] lg:gap-16">
        <section
          aria-labelledby="portal-360-title"
          className="max-w-xl border-l-2 border-primary pl-5"
        >
          <Portal360Mark size="md" />
          <h1
            className="mt-8 text-4xl font-semibold tracking-tight text-foreground"
            id="portal-360-title"
          >
            Un punto claro para el trabajo diario.
          </h1>
          <p className="mt-4 max-w-lg text-base leading-7 text-muted">
            Portal 360 reúne la estructura que el equipo necesitará para revisar y orientar su
            trabajo cuando los procesos estén definidos.
          </p>
        </section>

        <section aria-labelledby="access-status-title">
          <Surface padding="md" tone="raised">
            <h2
              className="text-2xl font-semibold tracking-tight text-foreground"
              id="access-status-title"
            >
              El acceso aún no está configurado.
            </h2>
            <p className="mt-3 text-sm leading-6 text-muted">
              Esta muestra no solicita credenciales ni inicia una sesión. El método de acceso se
              comunicará cuando esté definido.
            </p>

            <details className="mt-8 border-t border-border pt-5">
              <summary className="cursor-pointer text-sm font-semibold text-primary underline decoration-primary/30 underline-offset-4">
                Ver qué incluye esta muestra
              </summary>
              <p className="mt-3 text-sm leading-6 text-muted">
                Por ahora, esta vista presenta únicamente la identidad y la estructura de acceso de
                Portal 360. No hay proveedores, formularios ni información guardada.
              </p>
            </details>
          </Surface>
        </section>
      </div>
    </main>
  );
}
