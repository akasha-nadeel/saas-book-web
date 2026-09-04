"use client";

import { Menu, MenuButton } from "@/components/ui/menu";
import { shelfIcons } from "@/components/shelf/shelf-icons";

/**
 * One choice out of a short list, as a menu rather than a `<select>`.
 *
 * **Because a native select is the browser's, not the app's.** It draws in the
 * system font at the system size with the system's blue highlight and square
 * corners, sitting in the middle of a rounded pill that spent real effort on
 * both. On Windows it is a grey rectangle; on macOS it is something else again.
 * A control that looks different on every machine is the one thing on a
 * writing surface that cannot be designed, and the editor had two of them in
 * its formatting bar.
 *
 * **It is also the only control here that could not show a font in its own
 * face reliably** — `option { font-family }` is honoured by some browsers and
 * ignored by others, which is exactly the sort of thing a font picker must not
 * be vague about.
 *
 * Built on `Menu`, so it inherits the portal, the flip-up, the viewport
 * clamping and the four ways out — and on `MenuButton`'s `checked`, so each row
 * is a real `menuitemradio` and a screen reader is told which one is current
 * rather than being left to infer it from a tick.
 *
 * **Not for long lists.** Everything this replaces is six or seven fixed
 * options. A hundred fonts would want a filter field and a virtualised list,
 * which is a different component and should be written as one.
 */

export interface PickerOption<T extends string> {
  value: T;
  label: string;
  /**
   * Drawn on the row *and* on the trigger — which is the point for fonts: a
   * writer choosing Garamond over Baskerville is choosing between two shapes,
   * and a list of names set in one face is a list of words about shapes.
   */
  style?: React.CSSProperties;
}

export function Picker<T extends string>({
  label,
  value,
  options,
  onChange,
  width = 200,
  align = "start",
  triggerClassName = "",
}: {
  /** The accessible name — the trigger's text is the *value*, not the label. */
  label: string;
  value: T;
  options: readonly PickerOption<T>[];
  onChange: (next: T) => void;
  width?: number;
  align?: "start" | "end";
  triggerClassName?: string;
}) {
  const current = options.find((option) => option.value === value);

  return (
    <Menu
      /* The value goes in the name, because `aria-label` replaces the trigger's
         visible text rather than adding to it — without it a screen reader is
         told there is a menu and never which font is on. */
      label={`${label}: ${current?.label ?? value}`}
      align={align}
      width={width}
      triggerClassName={`flex shrink-0 items-center gap-1 rounded-lg px-2.5 py-1.5
                         font-sans text-sm text-fg outline-none transition-colors
                         hover:bg-raised focus-visible:ring-2
                         focus-visible:ring-accent/60 ${triggerClassName}`}
      trigger={
        <>
          <span className="truncate" style={current?.style}>
            {current?.label ?? value}
          </span>
          <span className="shrink-0 text-muted [&>svg]:h-3.5 [&>svg]:w-3.5">
            {shelfIcons.chevron}
          </span>
        </>
      }
    >
      {(close) => (
        <>
          {options.map((option) => (
            <MenuButton
              key={option.value}
              checked={option.value === value}
              badge={
                option.value === value ? shelfIcons.check : undefined
              }
              onClick={() => {
                onChange(option.value);
                close();
              }}
            >
              <span style={option.style}>{option.label}</span>
            </MenuButton>
          ))}
        </>
      )}
    </Menu>
  );
}
