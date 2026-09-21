"use client";

import { Icons } from "../icons";
import { Button } from "../ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "../ui/popover";

export function Notifications() {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          aria-label="Abrir notificaciones"
          className="size-8"
          size="icon"
          variant="secondary"
        >
          <Icons.notification />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 p-0">
        <div className="border-b px-4 py-3">
          <p className="text-sm font-semibold">Notificaciones</p>
        </div>
        <div className="flex min-h-36 flex-col items-center justify-center gap-2 px-6 py-8 text-center">
          <Icons.notification className="text-muted-foreground size-5" />
          <p className="text-sm font-medium">No hay notificaciones</p>
          <p className="text-muted-foreground text-sm">Las novedades aparecerán aquí.</p>
        </div>
      </PopoverContent>
    </Popover>
  );
}
