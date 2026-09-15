import Link from "next/link";

import { NotFoundState } from "../components/states/interface-states";

export default function NotFound() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-6">
      <NotFoundState
        action={
          <Link
            className="inline-flex h-10 items-center justify-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground transition-colors hover:opacity-90"
            href="/"
          >
            Volver a Inicio
          </Link>
        }
      />
    </main>
  );
}
