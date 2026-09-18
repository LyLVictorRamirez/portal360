import { redirect } from "next/navigation";
import type { ReactNode } from "react";

import { ApplicationShell } from "../../components/layout/application-shell";
import { resolveApplicationAccess } from "../../lib/application-access";
import { getServerAuthorization } from "../../lib/authorization-context";
import { getLoginUrl } from "../../lib/auth-route";
import { getServerSession } from "../../lib/auth-session";
import { UnauthorizedState } from "../../components/states/interface-states";

type ApplicationLayoutProps = Readonly<{
  children: ReactNode;
}>;

export default async function ApplicationLayout({ children }: ApplicationLayoutProps) {
  const session = await getServerSession();

  if (!session || !session.user.emailVerified) {
    redirect(getLoginUrl("/"));
  }

  const applicationAccess = resolveApplicationAccess(session, await getServerAuthorization());

  if (applicationAccess.kind === "unauthorized") {
    return <UnauthorizedState />;
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
