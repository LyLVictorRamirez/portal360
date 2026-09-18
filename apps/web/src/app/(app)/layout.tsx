import { redirect } from "next/navigation";
import type { ReactNode } from "react";

import { ApplicationShell } from "../../components/layout/application-shell";
import { getServerSession } from "../../lib/auth-session";

type ApplicationLayoutProps = Readonly<{
  children: ReactNode;
}>;

export default async function ApplicationLayout({ children }: ApplicationLayoutProps) {
  const session = await getServerSession();

  if (!session || !session.user.emailVerified) {
    redirect("/login?returnTo=%2F");
  }

  return <ApplicationShell>{children}</ApplicationShell>;
}
