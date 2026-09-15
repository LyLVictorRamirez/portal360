import { ArrowRight, PanelsTopLeft } from "lucide-react";

export default function LoginPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-6 py-12">
      <section aria-labelledby="login-title" className="w-full max-w-md">
        <div className="flex items-center gap-3 text-foreground">
          <div className="flex size-10 items-center justify-center rounded-md border border-border bg-surface">
            <PanelsTopLeft aria-hidden="true" size={19} strokeWidth={1.75} />
          </div>
          <span className="text-sm font-semibold tracking-tight">Portal 360</span>
        </div>

        <div className="mt-8 border border-border bg-surface p-6 sm:p-8">
          <h1 className="text-2xl font-semibold tracking-tight text-foreground" id="login-title">
            Iniciar sesión
          </h1>
          <p className="mt-2 text-sm leading-6 text-muted">
            Accede al espacio de trabajo de Portal 360 cuando el método de acceso esté definido.
          </p>
          <button
            className="mt-8 inline-flex h-10 w-full items-center justify-center gap-2 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground transition-colors hover:opacity-90"
            type="button"
          >
            Iniciar sesión
            <ArrowRight aria-hidden="true" size={17} strokeWidth={1.75} />
          </button>
        </div>
      </section>
    </main>
  );
}
