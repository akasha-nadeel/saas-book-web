"use client";

import { forwardRef } from "react";

/**
 * The filled field, drawn the way iOS draws a search bar.
 *
 * **Filled rather than outlined**, and that is the substantive difference: an
 * outlined field on a panel is a fifth box on a screen already made of boxes,
 * where a filled one reads as a well *in* the surface. The glyph sits inset in
 * the field rather than in a container beside it, and focus is a hairline
 * accent ring rather than a heavy border — a 2px blue outline on a 240px rail
 * is the loudest thing on the screen for as long as the caret is in it.
 *
 * **The clear control is a filled disc and appears only when there is something
 * to clear**, which is Apple's rule and a good one: an always-present ⓧ on an
 * empty field is a control that does nothing, and the house rules here forbid
 * exactly that.
 *
 * `forwardRef`, because two callers focus the field after clearing it.
 */

export const Field = forwardRef<
  HTMLInputElement,
  Omit<React.ComponentPropsWithoutRef<"input">, "className"> & {
    /** Drawn inset at the leading edge. A 24-grid stroked path, like the rails. */
    glyph?: React.ReactNode;
    /** Shown only while there is a value. Omit for a field with nothing to clear. */
    onClear?: () => void;
    clearLabel?: string;
    className?: string;
  }
>(function Field(
  { glyph, onClear, clearLabel = "Clear", value, className = "", ...props },
  ref,
) {
  const filled = typeof value === "string" ? value.length > 0 : Boolean(value);

  return (
    <div className={`relative flex items-center ${className}`}>
      {glyph && (
        <span
          aria-hidden="true"
          className="pointer-events-none absolute left-2.5 flex h-4 w-4 items-center justify-center text-muted"
        >
          {glyph}
        </span>
      )}

      <input
        ref={ref}
        value={value}
        {...props}
        className={`w-full rounded-[10px] bg-raised py-2 text-[13px] text-fg
                    outline-none transition-shadow placeholder:text-muted
                    focus:ring-2 focus:ring-accent/50
                    ${glyph ? "pl-8" : "pl-3"} ${onClear ? "pr-8" : "pr-3"}`}
      />

      {onClear && filled && (
        <button
          type="button"
          onClick={onClear}
          aria-label={clearLabel}
          className="absolute right-2 flex h-4 w-4 items-center justify-center
                     rounded-full text-muted outline-none transition-colors
                     hover:text-fg focus-visible:ring-2 focus-visible:ring-accent/60"
        >
          {/* The solid disc, not a bare cross: at 14px a stroked × reads as a
              stray mark in the field rather than as a control. */}
          <svg className="h-3.5 w-3.5" viewBox="0 0 16 16" fill="currentColor">
            <path d="M8 0a8 8 0 1 0 0 16A8 8 0 0 0 8 0ZM5.354 4.646 8 7.293l2.646-2.647a.5.5 0 0 1 .708.708L8.707 8l2.647 2.646a.5.5 0 0 1-.708.708L8 8.707l-2.646 2.647a.5.5 0 0 1-.708-.708L7.293 8 4.646 5.354a.5.5 0 1 1 .708-.708Z" />
          </svg>
        </button>
      )}
    </div>
  );
});

/** The magnifier, at the size and weight the fields want. */
export function SearchGlyph() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      className="h-4 w-4"
    >
      <path d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
    </svg>
  );
}

/** The swap arrows, for a replacement field. */
export function ReplaceGlyph() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      className="h-4 w-4"
    >
      <path d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
    </svg>
  );
}
