import type { ReactNode } from "react";

import { Portal360Mark } from "../ui/portal-360-mark";
import { Surface } from "../ui/surface";

type AuthPageShellProps = Readonly<{
  children: ReactNode;
  description: string;
  footer?: ReactNode;
  variant?: "default" | "entry";
  title: string;
}>;

export function AuthPageShell({
  children,
  description,
  footer,
  title,
  variant = "default",
}: AuthPageShellProps) {
  if (variant === "entry") {
    return (
      <main className="min-h-svh bg-background lg:grid lg:grid-cols-2">
        <section
          aria-labelledby="portal-360-title"
          className="hidden min-h-svh items-center px-10 py-12 lg:flex xl:px-20"
        >
          <div className="max-w-xl border-l-2 border-primary pl-5">
            <Portal360Mark size="md" />
            <h1
              className="mt-8 text-4xl font-semibold tracking-tight text-foreground"
              id="portal-360-title"
            >
              Un punto claro para el trabajo diario.
            </h1>
            <p className="mt-4 max-w-lg text-base leading-7 text-muted-foreground">
              Portal 360 reúne el trabajo del equipo en una experiencia ordenada y segura.
            </p>
          </div>
        </section>

        <section
          aria-labelledby="auth-page-title"
          className="flex min-h-svh items-center justify-center border-l border-border bg-muted px-4 py-8 sm:px-6 sm:py-12"
        >
          <div className="w-full max-w-md overflow-hidden rounded-2xl border border-border bg-card shadow-[0_18px_42px_-18px_color-mix(in_oklch,var(--foreground)_28%,transparent)]">
            <div className="px-6 py-8 sm:px-12 sm:py-10">
              <header className="mb-8 text-center">
                <Portal360Mark className="justify-center lg:hidden" size="sm" />
                <h2
                  className="mt-6 text-2xl font-semibold tracking-tight text-foreground lg:mt-0"
                  id="auth-page-title"
                >
                  {title}
                </h2>
                <p className="mt-3 text-sm leading-6 text-muted-foreground">{description}</p>
              </header>
              {children}
            </div>
            {footer ? (
              <footer className="border-t border-border bg-muted px-6 py-6 text-center sm:px-12">
                {footer}
              </footer>
            ) : null}
          </div>
        </section>
      </main>
    );
  }

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
          <p className="mt-4 max-w-lg text-base leading-7 text-muted-foreground">
            Portal 360 reúne el trabajo del equipo en una experiencia ordenada y segura.
          </p>
        </section>

        <section aria-labelledby="auth-page-title">
          <Surface padding="md" tone="raised">
            <h2
              className="text-2xl font-semibold tracking-tight text-foreground"
              id="auth-page-title"
            >
              {title}
            </h2>
            <p className="mt-3 text-sm leading-6 text-muted-foreground">{description}</p>
            <div className="mt-8">{children}</div>
          </Surface>
        </section>
      </div>
    </main>
  );
}
