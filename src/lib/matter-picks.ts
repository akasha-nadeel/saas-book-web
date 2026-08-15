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
 * `SUGGESTED` would be two answers to "what does a first novel usually have",
 * which is exactly the drift the `usual` flag in `matter.ts` was written to
 * avoid.
 */

/**
 * Ticked when the question is first put.
 *
 * A dedication and nothing else at the front, two pages at the back.
 *
 * The temptation is to pre-tick everything that looks standard, which is how a
 * setup screen turns into the Start button it was written to replace. What is
 * ticked here is what a first novel almost always has *and* what nothing else
 * in the app will make for you: the title, copyright and contents pages are
 * generated at export, the epigraph and the preface are genuine choices, and a
 * prologue is a decision about the story rather than about the book.
 */
export const SUGGESTED: Record<MatterPart, readonly string[]> = {
  front: ["Dedication"],
  back: ["Acknowledgements", "About the author"],
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
