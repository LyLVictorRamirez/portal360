import type { ReactNode } from "react";

type ApplicationLayoutProps = Readonly<{
  children: ReactNode;
}>;

export default function ApplicationLayout({ children }: ApplicationLayoutProps) {
  return children;
}
