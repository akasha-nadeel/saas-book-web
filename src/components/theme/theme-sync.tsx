"use client";

import { useEffect } from "react";
import { setTheme, systemTheme, themeUnset } from "@/lib/library-store";
import { usePrefs } from "@/lib/use-library";

/**
 * Keeps `<html data-theme>` in step with the stored preference.
 *
 * The very first paint is the inline script in the root layout, so there is no
 * flash of the wrong theme before React wakes up. This carries every change
 * after that — a toggle on this tab, or one in another, since `usePrefs` is
 * subscribed to both.
 *
 * **It resolves "system" rather than passing it through.** CSS only ever sees
 * `light` or `dark`, which is what lets the stylesheet hold exactly two blocks
 * instead of two plus a media query duplicating one of them. The cost is that
 * *this* has to listen: a writer on "system" whose laptop turns dark at sunset
 * gets the app turning with it, and without the listener below it would only
 * turn on the next reload.
 *
 * Rendered once, at the root. It draws nothing.
 */
export function ThemeSync() {
  const { theme } = usePrefs();

  useEffect(() => {
    const apply = () => {
      document.documentElement.dataset.theme =
        theme === "system" ? systemTheme() : theme;
    };
    apply();

    // Only "system" is asking to be told; the other two have already answered.
    if (theme !== "system") return;
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    media.addEventListener("change", apply);
    return () => media.removeEventListener("change", apply);
  }, [theme]);

  /*
   * One write for a library stored before the theme existed.
   *
   * Those carry the old light default — a white sheet — with no theme recorded
   * beside it. `setTheme` is what knows that an unpicked sheet should follow
   * the chrome, so running it once here is the whole migration, and it is done
   * in an effect because it is a *write*: deriving the same answer during a
   * read would have to be re-derived on every read and would go stale between
   * them. See `themeUnset`.
   */
  useEffect(() => {
    if (themeUnset()) setTheme("system");
  }, []);

  return null;
}
