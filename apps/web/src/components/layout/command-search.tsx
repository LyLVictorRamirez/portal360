"use client";

import { useKBar } from "kbar";

import { Icons } from "../icons";
import { Button } from "../ui/button";
import { Kbd } from "../ui/kbd";

export function CommandSearch() {
  const { query } = useKBar();

  return (
    <Button
      className="bg-background text-muted-foreground relative h-9 w-full justify-start rounded-[0.5rem] text-sm font-normal shadow-none md:w-44 lg:w-64"
      onClick={query.toggle}
      variant="outline"
    >
      <Icons.search className="mr-2 size-4" />
      Buscar…
      <Kbd className="absolute top-1/2 right-1 hidden -translate-y-1/2 sm:inline-flex">⌘ K</Kbd>
    </Button>
  );
}
