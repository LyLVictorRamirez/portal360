import type { ReactNode } from "react";

import { ApplicationShell } from "../../components/layout/application-shell";

type ApplicationLayoutProps = Readonly<{
  children: ReactNode;
}>;

export default function ApplicationLayout({ children }: ApplicationLayoutProps) {
  return <ApplicationShell>{children}</ApplicationShell>;
}
