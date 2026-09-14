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
 * `text-accent-ink` rather than a fixed white by day: the fill is the brand
 * blue, and the ink on it has to follow the theme. **At night the featured
 * card is the upgrade gradient** (see `CardTone` in `plan-card.tsx`), so the
 * button turns to a veil of white with white type — a periwinkle slab with
 * dark ink on a purple card would be a third colour on it.
 */
export const PLAN_BUTTON_PRIMARY = `block w-full rounded-xl bg-accent px-5 py-3
  text-center font-sans text-sm font-semibold text-accent-ink shadow-sm
  outline-none transition-[opacity,box-shadow,background-color] hover:opacity-90
  hover:shadow-md focus-visible:ring-2 focus-visible:ring-accent/60
  dark:bg-white/20 dark:text-white dark:ring-1 dark:ring-white/35
  dark:hover:bg-white/30 dark:hover:opacity-100 dark:focus-visible:ring-white/70`;

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
