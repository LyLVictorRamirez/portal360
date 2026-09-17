import type { Metadata } from "next";
import { IBM_Plex_Sans } from "next/font/google";
import type { ReactNode } from "react";

import "./globals.css";

const ibmPlexSans = IBM_Plex_Sans({
  display: "swap",
  fallback: ["Segoe UI", "Arial", "sans-serif"],
  subsets: ["latin"],
  variable: "--font-portal-360",
  weight: "variable",
});

export const metadata: Metadata = {
  title: "Portal 360",
  description: "Control operativo para el equipo LyL",
};

type RootLayoutProps = Readonly<{
  children: ReactNode;
}>;

export default function RootLayout({ children }: RootLayoutProps) {
  return (
    <html className={ibmPlexSans.variable} lang="es">
      <body>{children}</body>
    </html>
  );
}
