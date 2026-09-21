import type { Metadata } from "next";
import type { ReactNode } from "react";
import { cookies } from "next/headers";
import NextTopLoader from "nextjs-toploader";
import { NuqsAdapter } from "nuqs/adapters/next/app";

import Providers from "@/components/layout/providers";
import { fontVariables } from "@/components/themes/font.config";
import { DEFAULT_THEME, THEMES } from "@/components/themes/theme.config";
import ThemeProvider from "@/components/themes/theme-provider";
import { Toaster } from "@/components/ui/sonner";
import { cn } from "@/lib/utils";

import "./globals.css";

const META_THEME_COLORS = {
  light: "#ffffff",
  dark: "#09090b",
};

export const metadata: Metadata = {
  title: "Portal 360",
  description: "Control operativo para el equipo LyL",
};

export const viewport = {
  themeColor: META_THEME_COLORS.light,
};

type RootLayoutProps = Readonly<{
  children: ReactNode;
}>;

export default async function RootLayout({ children }: RootLayoutProps) {
  const cookieStore = await cookies();
  const activeThemeValue = cookieStore.get("active_theme")?.value;
  const isValidTheme = THEMES.some((theme) => theme.value === activeThemeValue);
  const themeToApply = isValidTheme ? activeThemeValue! : DEFAULT_THEME;

  return (
    <html data-theme={themeToApply} lang="es" suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `
              try {
                const mode = localStorage.getItem("portal-360:theme");
                const isDark = mode === "dark" ||
                  ((mode === null || mode === "system") &&
                    window.matchMedia("(prefers-color-scheme: dark)").matches);
                document.querySelector('meta[name="theme-color"]')?.setAttribute(
                  "content",
                  isDark ? "${META_THEME_COLORS.dark}" : "${META_THEME_COLORS.light}",
                );
              } catch {}
            `,
          }}
        />
      </head>
      <body
        className={cn(
          "overflow-x-hidden overscroll-none bg-background font-sans antialiased",
          fontVariables,
        )}
      >
        <NextTopLoader color="var(--primary)" showSpinner={false} />
        <NuqsAdapter>
          <ThemeProvider
            attribute="class"
            defaultTheme="system"
            disableTransitionOnChange
            enableColorScheme
            enableSystem
            storageKey="portal-360:theme"
          >
            <Providers activeThemeValue={themeToApply}>
              <Toaster />
              {children}
            </Providers>
          </ThemeProvider>
        </NuqsAdapter>
      </body>
    </html>
  );
}
