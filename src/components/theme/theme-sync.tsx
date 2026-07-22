"use client";

import { useEffect } from "react";
import { usePrefs } from "@/lib/use-library";

/**
 * Keeps <html data-theme> in step with the stored preference.
 *
 * The very first paint is handled by the inline script in the root layout, so
 * there is no flash of the wrong theme before React wakes up. This component
 * carries every change after that — a toggle on this tab, or one in another,
 * since usePrefs is subscribed to both.
 *
 * Rendered once, at the root. It draws nothing.
 */
export function ThemeSync() {
  const { theme } = usePrefs();

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
  }, [theme]);

  return null;
}
