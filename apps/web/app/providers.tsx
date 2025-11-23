"use client";

import { SessionProvider } from "next-auth/react";
import { ThemeProvider } from "next-themes";
import { ViewModeProvider } from "./contexts/ViewModeContext";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider>
      <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
        <ViewModeProvider>{children}</ViewModeProvider>
      </ThemeProvider>
    </SessionProvider>
  );
}
