"use client";

import { TINTS, setTheme, type Theme } from "@/lib/library-store";
import { usePrefs } from "@/lib/use-library";

/**
 * System / Light / Dark, as one segmented control.
 *
 * Three buttons rather than a switch, because there are three answers and one
 * of them is not a midpoint between the other two. A two-way switch has to
 * either drop "system" — which is the setting most people actually want, since
 * their machine already turns dark at sunset — or hide it behind a long press.
 *
 * **Icons only, with the label outside.** The row reads "Theme  ⟨▫ ☼ ☾⟩": the
 * three are a closed set anybody recognises, and spelling them out makes a
 * control three times the width for a word each. Every one still carries its
 * name for a screen reader and as a tooltip.
 *
 * A radiogroup rather than three buttons, so arrow keys move between them and
 * the group is announced as one control with one answer — which is what it is.
 */

const OPTIONS: { value: Theme; label: string; icon: React.ReactNode }[] = [
  {
    value: "system",
    label: "Match my system",
    icon: (
      <>
        <rect x="2.5" y="3.5" width="13" height="9" rx="1.6" />
        <path d="M6.5 15.5h5M9 12.5v3" />
      </>
    ),
  },
  {
    value: "light",
    label: "Light",
    icon: (
      <>
        <circle cx="9" cy="9" r="3.2" />
        <path d="M9 1.5v1.6M9 14.9v1.6M16.5 9h-1.6M3.1 9H1.5M14.3 3.7l-1.1 1.1M4.8 13.2l-1.1 1.1M14.3 14.3l-1.1-1.1M4.8 4.8 3.7 3.7" />
      </>
    ),
  },
  {
    value: "dark",
    label: "Dark",
    icon: (
      // A crescent cut by the path rather than by a mask, so it inherits
      // currentColor like every other icon in the app.
      <path d="M15.2 10.8A6.6 6.6 0 0 1 7.2 2.8a6.8 6.8 0 1 0 8 8Z" />
    ),
  },
];

export function ThemeToggle() {
  const { theme } = usePrefs();

  return (
    <div
      role="radiogroup"
      aria-label="Theme"
      className="inline-flex items-center gap-0.5 rounded-full border border-line
                 bg-surface p-0.5"
    >
      {OPTIONS.map((option) => {
        const active = theme === option.value;
        return (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={active}
            aria-label={option.label}
            title={option.label}
            onClick={() => setTheme(option.value)}
            className={`flex h-7 w-7 items-center justify-center rounded-full
                        outline-none transition-colors focus-visible:ring-2
                        focus-visible:ring-accent/60 ${
                          active
                            ? "bg-accent text-accent-ink"
                            : "text-muted hover:text-fg"
                        }`}
          >
            <svg
              aria-hidden="true"
              viewBox="0 0 18 18"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.4"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="h-4 w-4"
            >
              {option.icon}
            </svg>
          </button>
        );
      })}
    </div>
  );
}

/**
 * The six named themes, as a row of swatches under the three schemes.
 *
 * **Swatches and not a list of words**, because the answer is a colour: a
 * writer choosing between Tawny Leather and Dusty Olive is choosing what the
 * app will look like, and six names in a column tells them nothing they can
 * see. Each still carries its name for a screen reader and on hover.
 *
 * **The swatch is the seed**, which is the colour on the palette card — not the
 * ground the theme actually paints, which is that colour taken light or dark
 * until the text on it is readable. The seed is what makes the theme
 * recognisable; the derivation is in `globals.css` with its reasoning.
 *
 * One radiogroup with the three above it would have been truer to the fact that
 * this is one setting with nine answers, but a radiogroup's arrow keys would
 * then run through nine controls of two different shapes. Two groups, one
 * question — and pressing any of the nine is the same `setTheme`.
 */
export function TintSwatches() {
  const { theme } = usePrefs();

  return (
    <div
      role="radiogroup"
      aria-label="Colour theme"
      className="flex flex-wrap items-center gap-1.5"
    >
      {TINTS.map((tint) => {
        const active = theme === tint.id;
        return (
          <button
            key={tint.id}
            type="button"
            role="radio"
            aria-checked={active}
            aria-label={tint.name}
            title={tint.name}
            onClick={() => setTheme(tint.id)}
            className={`h-6 w-6 rounded-full border outline-none
                        transition-transform hover:scale-110
                        focus-visible:ring-2 focus-visible:ring-accent/60 ${
                          active
                            ? "border-accent ring-2 ring-accent/40"
                            : "border-line"
                        }`}
            style={{ background: tint.seed }}
          />
        );
      })}
    </div>
  );
}

/** The control with its name beside it, as it sits in a menu or a sidebar. */
export function ThemeRow({ className = "" }: { className?: string }) {
  return (
    <div className={`flex items-center justify-between gap-4 ${className}`}>
      <span className="font-sans text-sm text-fg">Theme</span>
      <ThemeToggle />
    </div>
  );
}
