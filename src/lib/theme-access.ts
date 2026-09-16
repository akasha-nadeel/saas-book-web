/**
 * Which colours the picker offers, and which of them are Pro.
 *
 * **Its own module, importing nothing but types**, for the reason
 * `consistency-ids.ts` gives: the pricing rows are read by Server Components and
 * the upgrade dialog counts them, while `library-store.ts` is a `"use client"`
 * store that reaches for IndexedDB. Both need these lists; only the picker needs
 * the store. The type-only imports are erased, so nothing is pulled in.
 *
 * `TINTS` in `library-store.ts` stays the one statement of what a tint *is* —
 * its name, its seed and its scheme. This module says only which of them a
 * writer is shown and which they have to pay for, so a palette can be held back
 * or sold without touching the theme system.
 */

import type { PaperColor, Tint } from "@/lib/library-store";

/**
 * The tints the Colour row draws, in order.
 *
 * **The three light tints — Parchment, Tawny Leather and Dusty Olive — are held
 * back for now, not deleted** (2026-09-16, the owner's call). Their entries in
 * `TINTS`, their two blocks each in `globals.css` and their line in the
 * bootstrap map all stay, so `theme-tints.test.ts` still holds the set together
 * and showing them again is one edit here. A writer already on one keeps it:
 * hiding is a filter over the picker, never a change to what a stored theme
 * means.
 */
export const SHOWN_TINTS: readonly Tint[] = ["copper", "aubergine", "charcoal"];

/**
 * The tints on the free plan. Every other shown tint is Pro.
 *
 * **One, and it is Copper Ink**, so Free is not a monochrome app — the point of
 * a free colour is that the writer can see what the paid ones are like, which a
 * locked row of swatches cannot show them.
 */
export const FREE_TINTS: readonly Tint[] = ["copper"];

/** The Pro-only tints, in the order they are shown. */
export const PRO_TINTS: readonly Tint[] = SHOWN_TINTS.filter(
  (id) => !FREE_TINTS.includes(id),
);

/**
 * The papers on the free plan. Every other paper is Pro.
 *
 * **The two dark sheets are what Pro buys**, because they are the ones a writer
 * chooses for the look rather than for the reading: "Match the theme" already
 * gives a dark page under a dark theme, so nobody writing at midnight is left
 * on white. Charcoal and Black are the deliberate pairing of a dark sheet with
 * a light app, which is a preference rather than a need.
 */
export const FREE_PAPERS: readonly PaperColor[] = [
  "theme",
  "white",
  "cream",
  "sepia",
];

/** The Pro-only papers, in the order `PAPERS` lists them. */
export const PRO_PAPERS: readonly PaperColor[] = ["slate", "black"];

/** Whether a tint is on Pro only. */
export function isProTint(id: Tint): boolean {
  return !FREE_TINTS.includes(id);
}

/** Whether a paper is on Pro only. */
export function isProPaper(paper: PaperColor): boolean {
  return !FREE_PAPERS.includes(paper);
}
