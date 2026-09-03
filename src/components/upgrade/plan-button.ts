/**
 * The two button skins a pricing card wears, written once.
 *
 * **They were written five times.** `PRO_BUTTON` and `PLAIN_BUTTON` lived in
 * `plans.tsx`, the Free card's link carried its own copy of the plain one, and
 * the landing page had three more inline — one filled, two outlined. Adding a
 * shadow to five hand-copied strings is how four of them end up with it and
 * nobody can say which page is the right one.
 *
 * **Plain strings and no JSX**, so a Server Component and a client component
 * can both read it. The same reason `plan-rows.ts` carries no `"use client"`.
 */

/**
 * The filled one, for the plan being recommended.
 *
 * `text-accent-ink` rather than a fixed white: the fill is the brand indigo by
 * day and a bright periwinkle at night, so the ink on it has to invert with it.
 * A hardcoded white is invisible in exactly one theme.
 */
export const PLAN_BUTTON_PRIMARY = `block w-full rounded-xl bg-accent px-5 py-3
  text-center font-sans text-sm font-semibold text-accent-ink shadow-sm
  outline-none transition-[opacity,box-shadow] hover:opacity-90 hover:shadow-md
  focus-visible:ring-2 focus-visible:ring-accent/60`;

/**
 * The quieter twin, for every card that is not the featured one.
 *
 * **Three filled accent buttons in a row is three primary actions**, which is
 * none: the eye has nowhere to land and the recommendation stops reading as a
 * recommendation. So the featured card keeps the fill and its neighbours take
 * an outline — still a real press, plainly secondary.
 */
export const PLAN_BUTTON_PLAIN = `block w-full rounded-xl border border-line
  bg-surface px-5 py-3 text-center font-sans text-sm font-semibold text-fg
  shadow-sm outline-none transition-[background-color,box-shadow]
  hover:bg-raised hover:shadow-md focus-visible:ring-2
  focus-visible:ring-accent/60`;

export function planButton(featured?: boolean): string {
  return featured ? PLAN_BUTTON_PRIMARY : PLAN_BUTTON_PLAIN;
}
