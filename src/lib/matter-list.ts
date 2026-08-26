/**
 * What the front- and back-matter cards list: every division the part offers,
 * whether or not the book has a page for it.
 *
 * The panel used to list only the pages a book *had*, and hid the other
 * fourteen behind an "Add page" menu. So a writer could not see, in one look,
 * which divisions their book has and which it does not — which is the question
 * the card exists to answer. Now each offered section is a row with a switch:
 * on when the page exists, off when it does not, and switching one on is what
 * adding a page has become.
 *
 * **This module is the merge, and it is pure so it can be tested**, because
 * the ordering rule is the part that is easy to get wrong.
 *
 * **Existing pages are never reordered.** The tempting version sorts the whole
 * list into catalogue order, which reads beautifully and is a lie for half the
 * book: `bindBook` sorts *front* matter by `matterSectionIndex`, and leaves the
 * body and the back in the writer's stored sequence
 * (`export/front-matter.ts` — "nothing here has any business reordering
 * them"). A back-matter page that arrived out of order — restored from the
 * trash, which appends, or retagged with `setChapterMatter`, which lands it at
 * the end of the part — would then sit in one place on this card and in
 * another in the finished book. So the pages come out exactly as they are
 * stored, and only the *offers* are placed.
 *
 * **An offer sits where its page would land if you switched it on.** That is
 * not a separate rule invented here: it is the same arithmetic
 * `createMatterPages` uses to decide where a new page goes — before the first
 * page of the part whose `matterSectionIndex` is greater. Get it from anywhere
 * else and the row would move the moment it was switched on.
 */

import {
  MATTER_SECTIONS,
  matterSection,
  matterSectionIndex,
  type MatterPart,
  type MatterSection,
} from "./matter";

/** The least a page needs to carry to be listed. */
export interface MatterListPage {
  id: string;
  title: string;
}

/**
 * One row of the card.
 *
 * `page` is a page the book has: `section` names the standard division it
 * fills, or is null for a page the writer named themselves — which is also
 * what a *second* page of the same name gets, since only one of them can be
 * the book's Dedication.
 *
 * `offer` is a division the book has no page for. It carries no id because
 * there is nothing to open yet.
 */
export type MatterRow<P extends MatterListPage> =
  | { kind: "page"; page: P; section: MatterSection | null }
  | { kind: "offer"; section: MatterSection };

/**
 * The part's pages and its unfilled divisions, as one list in reading order.
 *
 * Generic over the page so the panel can hand it `ChapterMeta` and a test can
 * hand it two fields — the same widening `bindBook` takes, and for the same
 * reason: four shapes of chapter travel through this app and none of them is
 * worth importing here.
 */
export function matterRows<P extends MatterListPage>(
  part: MatterPart,
  pages: readonly P[],
): MatterRow<P>[] {
  /* Which standard divisions are already spoken for. The *first* page of a
     name claims it: a book that imported two Dedications keeps both, but the
     second is the writer's own page rather than a second copy of the offer,
     so switching the row off cannot silently take the wrong one. */
  const claimed = new Set<string>();
  const rows: MatterRow<P>[] = pages.map((page) => {
    const section = matterSection(part, page.title);
    if (!section || claimed.has(section.title)) {
      return { kind: "page", page, section: null };
    }
    claimed.add(section.title);
    return { kind: "page", page, section };
  });

  /* The rank of each stored page, by the position it holds in the list — read
     once, because the list grows as offers are spliced into it. */
  const rankOf = (row: MatterRow<P>): number =>
    row.kind === "offer"
      ? matterSectionIndex(part, row.section.title)
      : matterSectionIndex(part, row.page.title);

  for (const section of MATTER_SECTIONS[part]) {
    if (claimed.has(section.title)) continue;
    const rank = matterSectionIndex(part, section.title);
    /* Before the first row that belongs after it — which puts an offer among
       the pages where its own page would go, and flushes what is left before
       any page the writer named, since those rank `Infinity`. */
    const at = rows.findIndex((row) => rankOf(row) > rank);
    const offer: MatterRow<P> = { kind: "offer", section };
    if (at === -1) rows.push(offer);
    else rows.splice(at, 0, offer);
  }

  return rows;
}
