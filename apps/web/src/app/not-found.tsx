import Link from "next/link";

import { NotFoundState } from "../components/states/interface-states";

export default function NotFound() {
  return (
    <main className="flex min-h-screen items-center bg-canvas px-6 py-8">
      <div className="mx-auto w-full max-w-5xl">
        <NotFoundState
          action={
            <Link
              className="inline-flex h-10 items-center text-sm font-semibold text-primary underline decoration-primary/30 underline-offset-4 transition-colors hover:text-primary-hover"
              href="/"
            >
              Volver a Inicio
            </Link>
          }
        />
      </div>
    </main>
  );
}
