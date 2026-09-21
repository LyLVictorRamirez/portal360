"use client";

import type { Action } from "kbar";
import { KBarAnimator, KBarPortal, KBarPositioner, KBarProvider, KBarSearch } from "kbar";
import type { ReactNode } from "react";

import RenderResults from "./render-result";
import useThemeSwitching from "./use-theme-switching";

type KBarProps = Readonly<{
  actions?: Action[];
  children: ReactNode;
}>;

export default function KBar({ actions = [], children }: KBarProps) {
  return (
    <KBarProvider actions={actions}>
      <KBarContent>{children}</KBarContent>
    </KBarProvider>
  );
}

function KBarContent({ children }: Readonly<{ children: ReactNode }>) {
  useThemeSwitching();

  return (
    <>
      <KBarPortal>
        <KBarPositioner className="fixed inset-0 z-99999 bg-background/80 p-0! backdrop-blur-sm">
          <KBarAnimator className="relative mt-64! w-full max-w-[600px] -translate-y-12! overflow-hidden rounded-lg border bg-card text-card-foreground shadow-lg">
            <div className="sticky top-0 z-10 border-b border-border bg-card">
              <KBarSearch
                className="w-full border-none bg-card px-6 py-4 text-lg outline-hidden focus:ring-0 focus:ring-offset-0 focus:outline-hidden"
                placeholder="Buscar una ruta o acción"
              />
            </div>
            <div className="max-h-[400px]">
              <RenderResults />
            </div>
          </KBarAnimator>
        </KBarPositioner>
      </KBarPortal>
      {children}
    </>
  );
}
