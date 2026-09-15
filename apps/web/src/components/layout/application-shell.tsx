import type { ReactNode } from "react";

import { AppSidebar } from "./app-sidebar";
import { TopBar } from "./top-bar";

type ApplicationShellProps = Readonly<{
  children: ReactNode;
}>;

export function ApplicationShell({ children }: ApplicationShellProps) {
  return (
    <div className="flex min-h-screen bg-background">
      <AppSidebar />
      <div className="flex min-w-0 flex-1 flex-col">
        <TopBar />
        <main className="min-w-0 flex-1 px-6 py-8 lg:px-8">{children}</main>
      </div>
    </div>
  );
}
