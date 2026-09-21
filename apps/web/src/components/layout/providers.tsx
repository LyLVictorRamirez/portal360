"use client";

import type { ReactNode } from "react";

import KBar from "@/components/kbar";
import { ActiveThemeProvider } from "@/components/themes/active-theme";
import { TooltipProvider } from "@/components/ui/tooltip";

import QueryProvider from "./query-provider";

type ProvidersProps = Readonly<{
  activeThemeValue: string;
  children: ReactNode;
}>;

export default function Providers({ activeThemeValue, children }: ProvidersProps) {
  return (
    <ActiveThemeProvider initialTheme={activeThemeValue}>
      <QueryProvider>
        <TooltipProvider delayDuration={0}>
          <KBar>{children}</KBar>
        </TooltipProvider>
      </QueryProvider>
    </ActiveThemeProvider>
  );
}
