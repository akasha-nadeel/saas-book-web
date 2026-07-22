"use client";

import { setPref } from "@/lib/library-store";
import { usePrefs } from "@/lib/use-library";

/**
 * Flips between the light and dark theme.
 *
 * A self-styled icon button, sized for a header or toolbar. The editor's rails
 * carry their own toggle built from RailButton instead, so this one only has to
 * suit the chrome it sits in here.
 *
 * The glyph is a half-filled circle — the settled convention for "appearance",
 * and unambiguous in a way a lone sun or moon is not: it shows the choice, not
 * one side of it.
 */
export function ThemeToggle({ className = "" }: { className?: string }) {
  const { theme } = usePrefs();
  const next = theme === "dark" ? "light" : "dark";

  return (
    <button
      type="button"
      onClick={() => setPref("theme", next)}
      aria-label={`Switch to ${next} theme`}
      title={`Switch to ${next} theme`}
      className={`rounded-md p-2 text-muted outline-none transition-colors
                  hover:bg-raised hover:text-fg focus-visible:ring-2
                  focus-visible:ring-accent/60 ${className}`}
    >
      <svg
        aria-hidden="true"
        viewBox="0 0 20 20"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="h-5 w-5"
      >
        <circle cx="10" cy="10" r="7" />
        {/* The right half, filled — the contrast mark. */}
        <path d="M10 3a7 7 0 0 1 0 14z" fill="currentColor" stroke="none" />
      </svg>
    </button>
  );
}
