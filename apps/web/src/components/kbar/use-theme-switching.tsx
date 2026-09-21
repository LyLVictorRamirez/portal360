"use client";

import { useRegisterActions } from "kbar";
import { useMemo } from "react";
import { useTheme } from "next-themes";

export default function useThemeSwitching() {
  const { resolvedTheme, setTheme } = useTheme();

  const actions = useMemo(
    () => [
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
    [resolvedTheme, setTheme],
  );

  useRegisterActions(actions, actions);
}
