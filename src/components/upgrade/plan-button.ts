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
 *
 * **Both are filled since 2026-09-16**, as the reference design the cards copy
 * draws them: indigo on the white card, gold on the indigo one. Each is the
 * only button on its own card, so two fills side by side are two answers
 * rather than two competing primaries. See `price-*` in `globals.css`.
 */

/**
 * The one shape both share: 3rem tall, a small radius, Roboto at 1.0625rem.
 *
 * It lifts a pixel and deepens on hover rather than fading, because fading a
 * fill towards the card behind it is the one direction that reads as less
 * pressable.
 */
const SHAPE = `flex h-12 w-full items-center justify-center rounded-[0.3rem] px-5
  text-center font-pricing text-[1.0625rem] font-medium outline-none
  transition-[transform,filter] hover:-translate-y-px hover:brightness-95
  focus-visible:ring-2 focus-visible:ring-offset-2`;

/** Gold, for the indigo card. */
export const PLAN_BUTTON_PRIMARY = `${SHAPE} bg-price-gold text-price-gold-ink
  focus-visible:ring-price-gold focus-visible:ring-offset-price-brand`;

/** Indigo, for the white card. */
export const PLAN_BUTTON_PLAIN = `${SHAPE} bg-price-brand text-white
  focus-visible:ring-price-brand focus-visible:ring-offset-price-card`;

export function planButton(featured?: boolean): string {
  return featured ? PLAN_BUTTON_PRIMARY : PLAN_BUTTON_PLAIN;
}
