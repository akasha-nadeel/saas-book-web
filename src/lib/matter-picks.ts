import { MATTER_SECTIONS, type MatterPart } from "./matter";
import type { MatterPick } from "./library-store";

/**
 * Which front and back pages are ticked, and how a set of ticks becomes an
 * ordered list of pages to make.
 *
 * **Pulled out of the setup dialog on 2026-08-15**, when `/book/new` grew the
 * same question as two steps of its own. Two screens now ask it — the wizard on
 * the way in, and the dialog for a book that arrived some other way (an import,
 * or one made before the wizard existed) — and the three things they must agree
 * about are here rather than in either of them: what is ticked to begin with,
 * how a tick is keyed, and what order the pages come out in. Two copies of
 * `SUGGESTED` would be two answers to one question, which is exactly the drift
 * the `usual` flag in `matter.ts` was written to avoid.
 */

/**
 * Ticked when the question is first put — **nothing, on purpose**.
 *
 * It was a dedication at the front and two pages at the back, on the reasoning
 * that those are what a first novel almost always has. That is true and it is
 * not the question the screen asks. The deck says *tick only what you will
 * actually write*, and a tick that arrives already made is not something the
 * writer said: it makes a page of `[placeholders]` they never asked for, which
 * then turns up in the export's "not going in" note as a page they have to be
 * told about. Three pages nobody chose, explained back to them later.
 *
 * The `usual` flag is what carries the advice now — it marks the rows most
 * books have, so the recommendation is *shown* rather than *acted on*, and the
 * writer's own ticks are the only ones in the set. Which is also what makes
 * the count under the list honest: "0 pages selected" is true of somebody who
 * has not chosen yet.
 *
 * Kept as a table rather than deleted: it is the one place the default lives,
 * and a future decision to pre-tick something again belongs here rather than
 * in whichever screen thought of it first.
 */
export const SUGGESTED: Record<MatterPart, readonly string[]> = {
  front: [],
  back: [],
};

/**
 * How one tick is identified.
 *
 * Keyed "part:title" so the two parts cannot collide — both could hold a page
 * called "Glossary", and a set of bare titles would tick both at once.
 */
export function matterKey(part: MatterPart, title: string): string {
  return `${part}:${title}`;
}

/** The starting ticks, as the set both screens hold in state. */
export function defaultPicked(): Set<string> {
  return new Set([
    ...SUGGESTED.front.map((t) => matterKey("front", t)),
    ...SUGGESTED.back.map((t) => matterKey("back", t)),
  ]);
}

/**
 * The ticked pages, in the order a book is bound.
 *
 * Built by walking `MATTER_SECTIONS` rather than the picked set, so the pages
 * are created in binding order whatever order they were ticked in — a writer
 * who ticks the prologue before the dedication still gets the dedication
 * first. `parts` narrows it to one end of the book, which is what lets the
 * wizard count a single step without recomputing the other.
 */
export function picksFrom(
  picked: ReadonlySet<string>,
  parts: readonly MatterPart[] = ["front", "back"],
): MatterPick[] {
  return parts.flatMap((part) =>
    MATTER_SECTIONS[part]
      .filter((section) => picked.has(matterKey(part, section.title)))
      .map((section) => ({ part, title: section.title })),
  );
}

/** How many pages are ticked at one end of the book. */
export function countPicked(
  picked: ReadonlySet<string>,
  part: MatterPart,
): number {
  return picksFrom(picked, [part]).length;
}

/**
 * "3 pages" — the phrase both screens put on a button and in a count.
 *
 * One page is not "1 pages", and nought is worth saying in words rather than
 * as a numeral: a control reading "Add 0 pages" is a control that looks broken.
 */
export function pagesLabel(count: number): string {
  return `${count} ${count === 1 ? "page" : "pages"}`;
}
