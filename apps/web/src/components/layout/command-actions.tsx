"use client";

import { useRouter } from "next/navigation";
import { useMemo } from "react";
import { useRegisterActions } from "kbar";

import {
  getVisibleAdministrationNavigation,
  getVisibleBusinessNavigation,
} from "../../lib/administration-navigation";
import type { AuthorizationPermission } from "../../lib/authorization";

type CommandActionsProps = Readonly<{
  permissions: readonly AuthorizationPermission[];
}>;

export function CommandActions({ permissions }: CommandActionsProps) {
  const router = useRouter();
  const actions = useMemo(() => {
    const visibleRoutes = [
      { href: "/", label: "Inicio", section: "Navegación" },
      ...getVisibleBusinessNavigation(permissions).map((item) => ({
        href: item.href,
        label: item.label,
        section: "Navegación",
      })),
      ...getVisibleAdministrationNavigation(permissions).map((item) => ({
        href: item.href,
        label: item.label,
        section: "Administración",
      })),
    ];

    return visibleRoutes.map((route) => ({
      id: `navigate-${route.href}`,
      name: route.label,
      section: route.section,
      perform: () => router.push(route.href),
    }));
  }, [permissions, router]);

  useRegisterActions(actions, actions);

  return null;
}
