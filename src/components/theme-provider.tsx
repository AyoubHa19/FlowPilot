"use client";

import { ThemeProvider as NextThemesProvider } from "next-themes";
import type { ReactNode } from "react";

/** The app is dark only; next-themes stays so shadcn parts (toasts) read "dark". */
export function ThemeProvider({ children }: { children: ReactNode }) {
  return (
    <NextThemesProvider attribute="class" forcedTheme="dark" disableTransitionOnChange>
      {children}
    </NextThemesProvider>
  );
}
