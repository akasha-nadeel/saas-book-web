"use client";

import { forwardRef } from "react";

/**
 * The button this app spent 299 buttons not having.
 *
 * They are spread across 98 files, and the primary action alone was written
 * eight different ways — `px-4 py-2`, `px-5 py-2.5`, `px-4 py-2.5`,
 * `px-3 py-1.5`, `rounded-lg` beside `rounded-md`, `font-semibold` beside
 * `font-medium`, `hover:opacity-90` beside `hover:bg-accent-strong`, and three
 * different disabled opacities. None of that was a decision; it is what happens
 * when every call site types the classes again. `ui/` takes a thing on the
 * third copy, and this is well past it.
 *
 * **It wears the dialog palette, not the app's accent.** These tokens are
 * Tremor's, added for the dialog system — see the note in `globals.css`. That
 * makes this component the dialog system's button rather than a general one,
 * and it is why adopting it on an ordinary screen is the wrong move: the app's
 * chrome spends its one hue on `accent`, meaning *the way forward*, and a blue
 * fill out there would be a second answer to that question.
 *
 * **No `dark:` anywhere.** The tokens carry their own theme, so one class name
 * is correct in daylight and at night.
 */

type Variant = "primary" | "secondary" | "danger" | "ghost";
type Size = "sm" | "md" | "lg";

const VARIANTS: Record<Variant, string> = {
  primary:
    "bg-tremor-brand text-tremor-brand-inverted shadow-tremor-input " +
    "hover:bg-tremor-brand-emphasis",
  /**
   * The quiet half of a pair, and deliberately not a bordered "outline"
   * button. Cancel is the answer a reader should be able to find and not the
   * one being recommended, so it carries weight in its label alone.
   */
  secondary:
    "text-tremor-content-strong hover:bg-tremor-background-subtle",
  /**
   * Red, and not the brand. A destructive action must not wear the colour that
   * everywhere else means *proceed* — the same reasoning `ConfirmDialog`
   * already used for `bg-danger`.
   */
  danger:
    "bg-red-500 text-white shadow-tremor-input hover:bg-red-600",
  /** For an icon sitting on its own, such as the dialog's close cross. */
  ghost:
    "text-tremor-content-subtle hover:bg-tremor-background-subtle " +
    "hover:text-tremor-content",
};

const SIZES: Record<Size, string> = {
  sm: "px-3 py-1.5 text-xs",
  md: "px-4 py-2 text-sm",
  lg: "px-5 py-2.5 text-sm",
};

const RING: Record<Variant, string> = {
  primary: "focus-visible:ring-tremor-brand/60",
  secondary: "focus-visible:ring-tremor-brand/60",
  danger: "focus-visible:ring-red-500/60",
  ghost: "focus-visible:ring-tremor-brand/60",
};

export interface ButtonProps
  extends React.ComponentPropsWithoutRef<"button"> {
  variant?: Variant;
  size?: Size;
  /** For the one-button dialogs, where the action fills the foot. */
  fullWidth?: boolean;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  function Button(
    {
      variant = "primary",
      size = "md",
      fullWidth = false,
      className = "",
      type = "button",
      ...props
    },
    ref,
  ) {
    return (
      <button
        ref={ref}
        /* Defaulted, because a bare <button> inside a <form> submits it, and
           that has been the cause of more than one accidental save. A caller
           that wants a submit says so. */
        type={type}
        className={[
          "inline-flex items-center justify-center gap-2 whitespace-nowrap",
          "rounded-tremor-small font-sans font-medium outline-none",
          "transition-colors focus-visible:ring-2",
          /* One disabled treatment, where there were three. */
          "disabled:pointer-events-none disabled:opacity-50",
          SIZES[size],
          VARIANTS[variant],
          RING[variant],
          fullWidth ? "w-full" : "",
          className,
        ]
          .filter(Boolean)
          .join(" ")}
        {...props}
      />
    );
  },
);
