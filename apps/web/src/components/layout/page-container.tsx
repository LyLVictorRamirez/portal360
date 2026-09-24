import type { ReactNode } from "react";

import { Heading } from "../ui/heading";
import type { InfobarContent } from "../ui/infobar";
import { cn } from "../../lib/utils";

type PageContainerProps = Readonly<{
  access?: boolean;
  accessFallback?: ReactNode;
  children: ReactNode;
  className?: string;
  infoContent?: InfobarContent;
  isLoading?: boolean;
  pageDescription?: string;
  pageHeaderAction?: ReactNode;
  pageTitle?: string;
}>;

function PageSkeleton() {
  return (
    <div className="flex flex-1 animate-pulse flex-col gap-4">
      <div>
        <div className="bg-muted mb-2 h-8 w-48 rounded" />
        <div className="bg-muted h-4 w-96 max-w-full rounded" />
      </div>
      <div className="bg-muted h-40 w-full rounded-lg" />
      <div className="bg-muted h-40 w-full rounded-lg" />
    </div>
  );
}

export function PageContainer({
  access = true,
  accessFallback,
  children,
  className,
  infoContent,
  isLoading = false,
  pageDescription,
  pageHeaderAction,
  pageTitle,
}: PageContainerProps) {
  if (!access) {
    return (
      <div className="flex flex-1 items-center justify-center px-4 py-6 md:px-6">
        {accessFallback ?? (
          <p className="text-muted-foreground text-center text-lg">
            No tienes acceso a esta pantalla.
          </p>
        )}
      </div>
    );
  }

  return (
    <div
      className={cn(
        "flex min-h-0 min-w-0 flex-1 flex-col px-4 pt-2 pb-4 md:px-6 md:pt-4",
        className,
      )}
    >
      {pageTitle || pageHeaderAction ? (
        <div className="mb-4 flex items-start justify-between gap-4">
          {pageTitle ? (
            <Heading
              description={pageDescription ?? ""}
              infoContent={infoContent}
              title={pageTitle}
            />
          ) : (
            <span />
          )}
          {pageHeaderAction ? <div className="shrink-0">{pageHeaderAction}</div> : null}
        </div>
      ) : null}
      {isLoading ? <PageSkeleton /> : children}
    </div>
  );
}
