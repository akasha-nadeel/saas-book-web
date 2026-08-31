"use client";

import { forwardRef, useId } from "react";

/**
 * A labelled field, with somewhere for the error to go.
 *
 * The dialogs hand-rolled this the way they hand-rolled their buttons, and the
 * part that kept getting dropped is the last one: a field that can be wrong
 * needs a place to say so that is **tied to the input**, not a red sentence
 * floating near it. `aria-describedby` and `aria-invalid` are what a screen
 * reader needs to read the two together, and they are exactly what a
 * hand-rolled copy forgets.
 *
 * Wears the dialog palette — see `ui/button.tsx` for why that scopes it to
 * dialogs.
 */

export interface TextInputProps
  extends Omit<React.ComponentPropsWithoutRef<"input">, "size"> {
  label: string;
  /**
   * Marks the field wrong and, with `errorMessage`, says why.
   *
   * Separate from the message because a field can be known-wrong before there
   * is anything useful to say about it — a failed submit marks every empty
   * required field, and only some of them have a sentence worth printing.
   */
  error?: boolean;
  errorMessage?: string;
  /** Under the field, when it needs a word of explanation rather than a fault. */
  hint?: string;
}

export const TextInput = forwardRef<HTMLInputElement, TextInputProps>(
  function TextInput(
    { label, error = false, errorMessage, hint, className = "", id, ...props },
    ref,
  ) {
    const generated = useId();
    const inputId = id ?? generated;
    const noteId = `${inputId}-note`;
    const note = error ? errorMessage : hint;

    return (
      <div className={className}>
        <label
          htmlFor={inputId}
          className="block font-sans text-sm font-medium text-tremor-content-strong"
        >
          {label}
        </label>
        <input
          ref={ref}
          id={inputId}
          aria-invalid={error || undefined}
          aria-describedby={note ? noteId : undefined}
          className={[
            "mt-2 w-full rounded-tremor-small border bg-tremor-background",
            "px-3 py-2 font-sans text-sm text-tremor-content-strong",
            "shadow-tremor-input outline-none transition-colors",
            "placeholder:text-tremor-content-subtle",
            "disabled:cursor-not-allowed disabled:opacity-50",
            "focus-visible:ring-2",
            error
              ? "border-red-500 focus-visible:ring-red-500/40"
              : "border-tremor-border focus-visible:border-tremor-brand focus-visible:ring-tremor-brand/40",
          ].join(" ")}
          {...props}
        />
        {note && (
          <p
            id={noteId}
            className={`mt-2 font-sans text-xs ${
              error ? "text-red-500" : "text-tremor-content"
            }`}
          >
            {note}
          </p>
        )}
      </div>
    );
  },
);
