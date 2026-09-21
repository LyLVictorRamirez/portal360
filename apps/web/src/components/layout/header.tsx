"use client";

import { Breadcrumbs } from "./breadcrumbs";
import { CommandSearch } from "./command-search";
import { Notifications } from "./notifications";
import { ThemeModeToggle } from "../themes/theme-mode-toggle";
import { ThemeSelector } from "../themes/theme-selector";
import { Separator } from "../ui/separator";
import { SidebarTrigger } from "../ui/sidebar";

export function Header() {
  return (
    <header className="bg-background/60 sticky top-0 z-20 flex h-16 shrink-0 items-center justify-between gap-2 backdrop-blur-md md:h-14">
      <div className="flex items-center gap-2 px-4">
        <SidebarTrigger className="-ml-1" />
        <Separator className="mr-2 h-4" orientation="vertical" />
        <Breadcrumbs />
      </div>

      <div className="flex items-center gap-2 px-4">
        <div className="hidden md:flex">
          <CommandSearch />
        </div>
        <ThemeModeToggle />
        <div className="hidden sm:block">
          <ThemeSelector />
        </div>
        <Notifications />
      </div>
    </header>
  );
}
