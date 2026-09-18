import { redirect } from "next/navigation";
import type { ReactNode } from "react";

import { ApplicationShell } from "../../components/layout/application-shell";
import { getLoginUrl } from "../../lib/auth-route";
import { getServerSession } from "../../lib/auth-session";

type ApplicationLayoutProps = Readonly<{
  children: ReactNode;
}>;

export default async function ApplicationLayout({ children }: ApplicationLayoutProps) {
  const session = await getServerSession();

  if (!session || !session.user.emailVerified) {
    redirect(getLoginUrl("/"));
  }

  return (
    <ApplicationShell
      user={{
        email: session.user.email,
        name: session.user.name,
      }}
    >
      {children}
    </ApplicationShell>
  );
}
