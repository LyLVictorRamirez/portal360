import { cookies } from "next/headers";
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

  if (applicationAccess.kind !== "authorized") {
    return <UnauthorizedState />;
  }

  const cookieStore = await cookies();
  const defaultSidebarOpen = cookieStore.get("sidebar_state")?.value === "true";

  return (
    <ApplicationShell
      defaultSidebarOpen={defaultSidebarOpen}
      permissions={applicationAccess.authorization.permissions}
      user={{
        email: session.user.email,
        image: session.user.image,
        name: session.user.name,
      }}
    >
      {children}
    </ApplicationShell>
  );
}
