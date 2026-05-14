"use client";

import { ThemeProvider as NextThemesProvider } from "next-themes";
import type { ReactNode } from "react";

interface ThemeProviderProps {
  children: ReactNode;
}

/**
 * iCSFD+ Theme Provider
 *
 * Wraps next-themes ThemeProvider with UMak-specific defaults:
 * - `attribute="class"` — toggles `.dark` on <html> for Tailwind dark mode
 * - `defaultTheme="light"` — public pages default to light; internal pages
 *   can set `forcedTheme="dark"` per-route.
 * - `enableSystem={false}` — we control the theme explicitly, not OS prefs.
 * - `disableTransitionOnChange={false}` — smooth color transitions on toggle.
 */
export function ThemeProvider({ children }: ThemeProviderProps) {
  return (
    <NextThemesProvider
      attribute="class"
      defaultTheme="light"
      enableSystem={false}
      disableTransitionOnChange={false}
    >
      {children}
    </NextThemesProvider>
  );
}
