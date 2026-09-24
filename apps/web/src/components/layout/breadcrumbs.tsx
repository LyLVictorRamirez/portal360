"use client";

import Link from "next/link";
import { Fragment, useMemo } from "react";
import { usePathname } from "next/navigation";

import { Icons } from "../icons";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "../ui/breadcrumb";

type BreadcrumbItemData = Readonly<{
  href?: string;
  title: string;
}>;

const breadcrumbMap: Record<string, readonly BreadcrumbItemData[]> = {
  "/": [{ title: "Inicio" }],
  "/clientes": [{ href: "/", title: "Inicio" }, { title: "Clientes" }],
  "/proyectos": [{ href: "/", title: "Inicio" }, { title: "Proyectos" }],
  "/requerimientos": [{ href: "/", title: "Inicio" }, { title: "Requerimientos" }],
  "/actividades": [{ href: "/", title: "Inicio" }, { title: "Actividades" }],
  "/administracion/configuracion/codigos": [
    { href: "/", title: "Inicio" },
    { title: "Administración" },
    { title: "Códigos" },
  ],
  "/administracion/usuarios": [
    { href: "/", title: "Inicio" },
    { title: "Administración" },
    { title: "Usuarios" },
  ],
  "/administracion/roles": [
    { href: "/", title: "Inicio" },
    { title: "Administración" },
    { title: "Roles y permisos" },
  ],
  "/administracion/categorias-actividad": [
    { href: "/", title: "Inicio" },
    { title: "Administración" },
    { title: "Categorías de actividad" },
  ],
};

export function Breadcrumbs() {
  const pathname = usePathname();
  const items = useMemo(() => breadcrumbMap[pathname] ?? [{ title: "Portal 360" }], [pathname]);

  return (
    <Breadcrumb>
      <BreadcrumbList>
        {items.map((item, index) => {
          const isCurrent = index === items.length - 1;

          return (
            <Fragment key={`${item.title}-${index}`}>
              <BreadcrumbItem className={isCurrent ? undefined : "hidden md:block"}>
                {isCurrent ? (
                  <BreadcrumbPage>{item.title}</BreadcrumbPage>
                ) : item.href ? (
                  <BreadcrumbLink asChild>
                    <Link href={item.href}>{item.title}</Link>
                  </BreadcrumbLink>
                ) : (
                  <span>{item.title}</span>
                )}
              </BreadcrumbItem>
              {!isCurrent ? (
                <BreadcrumbSeparator className="hidden md:block">
                  <Icons.slash />
                </BreadcrumbSeparator>
              ) : null}
            </Fragment>
          );
        })}
      </BreadcrumbList>
    </Breadcrumb>
  );
}
