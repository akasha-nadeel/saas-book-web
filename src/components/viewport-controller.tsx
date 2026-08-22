"use client";

import { useVisualViewportCssVariables } from "@/lib/use-visual-viewport";

/** Publishes safe, keyboard-aware viewport CSS variables for the app shell. */
export function ViewportController() {
  useVisualViewportCssVariables();
  return null;
}
