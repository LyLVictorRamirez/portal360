import type { ReactNode } from "react";

import { Heading } from "./heading";

type PageHeaderProps = Readonly<{
  actions?: ReactNode;
  description?: string;
  title: string;
}>;

export function PageHeader({ actions, description, title }: PageHeaderProps) {
  return (
    <header className="flex flex-col gap-4 border-b border-border pb-6 sm:flex-row sm:items-start sm:justify-between">
      <Heading as="h1" description={description ?? ""} title={title} />
      {actions ? (
        <div className="flex shrink-0 flex-wrap items-center gap-2 sm:justify-end">{actions}</div>
      ) : null}
    </header>
  );
}
