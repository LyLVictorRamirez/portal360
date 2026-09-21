"use client";

import type { ReactNode } from "react";

import { AppSidebar } from "./app-sidebar";
import { CommandActions } from "./command-actions";
import { InfoSidebar } from "./info-sidebar";
import { Header } from "./header";
import { PageContainer } from "./page-container";
import { InfobarProvider } from "../ui/infobar";
import { SidebarInset, SidebarProvider } from "../ui/sidebar";
import type { AuthorizationPermission } from "../../lib/authorization";

type ApplicationShellProps = Readonly<{
  children: ReactNode;
  defaultSidebarOpen: boolean;
  permissions: readonly AuthorizationPermission[];
  user: {
    email: string;
    image: string | null;
    name: string;
  };
}>;

export function ApplicationShell({
  children,
  defaultSidebarOpen,
  permissions,
  user,
}: ApplicationShellProps) {
  return (
    <SidebarProvider defaultOpen={defaultSidebarOpen}>
      <AppSidebar permissions={permissions} user={user} />
      <SidebarInset>
        <Header />
        <InfobarProvider defaultOpen={false}>
          <CommandActions permissions={permissions} />
          <PageContainer>{children}</PageContainer>
          <InfoSidebar side="right" />
        </InfobarProvider>
      </SidebarInset>
    </SidebarProvider>
  );
}
