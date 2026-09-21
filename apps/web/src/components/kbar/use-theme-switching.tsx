"use client";

import { useRegisterActions } from "kbar";
import { useMemo } from "react";
import { useTheme } from "next-themes";

import { useThemeConfig } from "@/components/themes/active-theme";
import { THEMES } from "@/components/themes/theme.config";

export default function useThemeSwitching() {
  const { resolvedTheme, setTheme } = useTheme();
  const { activeTheme, setActiveTheme } = useThemeConfig();

  const actions = useMemo(
    () => [
      {
        id: "cycle-theme",
        name: "Cambiar paleta",
        section: "Tema",
        shortcut: ["t", "t"],
        perform: () => {
          const currentIndex = THEMES.findIndex((theme) => theme.value === activeTheme);
          const nextIndex = (currentIndex + 1) % THEMES.length;
          setActiveTheme(THEMES[nextIndex]?.value ?? THEMES[0].value);
        },
      },
      {
        id: "toggle-color-mode",
        name: "Alternar modo claro u oscuro",
        section: "Tema",
        shortcut: ["d", "d"],
        perform: () => setTheme(resolvedTheme === "dark" ? "light" : "dark"),
      },
      {
        id: "set-light-mode",
        name: "Usar modo claro",
        section: "Tema",
        perform: () => setTheme("light"),
      },
      {
        id: "set-dark-mode",
        name: "Usar modo oscuro",
        section: "Tema",
        perform: () => setTheme("dark"),
      },
    ],
    [activeTheme, resolvedTheme, setActiveTheme, setTheme],
  );

  useRegisterActions(actions, actions);
}
