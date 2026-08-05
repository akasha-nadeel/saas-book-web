import type { Book } from "./library-store";

/**
 * Blank page to published, in the order it actually has to happen.
 *
 * This is the most-confirmed thing in the research and the cheapest to build.
 * Three separate threads describe the same injury — not a missing tool, a
 * missing *order*. The clearest case was a writer who wrote:
 *
 *   "I've realized how absolutely essential ARCs are… Now I'm trying to get
 *    reviews for a book that has been published for a few months."
 *
 * They did not lack software. They lacked somebody telling them, in March, that
 * March was when the ARC readers had to be lined up. **So the load-bearing part
 * of this list is where "Line up ARC readers" sits: before publishing, not
 * after.** Everything else is arrangement.
 *
 * **Most steps work out for themselves whether they are done**, from what is
 * already in the book, rather than waiting to be ticked. A checklist a writer
 * has to maintain by hand is a second job, and it goes stale the first time
 * they forget — at which point it is lying, which is worse than not existing.
 * The steps that cannot be detected (getting a cover made, sending the ARCs)
 * are ticked by hand and say so.
 */

export type Phase = "write" | "revise" | "prepare" | "launch" | "publish";

export const PHASES: { id: Phase; label: string; note: string }[] = [
  { id: "write", label: "Write", note: "Get the words down." },
  { id: "revise", label: "Revise", note: "Make them the right words." },
  {
    id: "prepare",
    label: "Prepare",
    note: "Everything a shop asks for that is not the book.",
  },
  {
    id: "launch",
    label: "Before you publish",
    note: "The part almost everybody finds out about too late.",
  },
  { id: "publish", label: "Publish", note: "And check what you sent." },
];

export interface Step {
  id: string;
  phase: Phase;
  title: string;
  /** Why it matters, in the writer's terms. */
  note: string;
  /** Where in the app this step is done, when it is done here. */
  href?: (bookId: string) => string;
  /**
   * Works out from the book whether this is already done. Absent means the
   * step happens outside the app and is ticked by hand.
   */
  done?: (book: Book) => boolean;
}

const hasWords = (book: Book, atLeast: number) =>
  book.chapters.reduce((sum, c) => sum + (c.words ?? 0), 0) >= atLeast;

export const STEPS: Step[] = [
  // ---- Write -------------------------------------------------------------
  {
    id: "start",
    phase: "write",
    title: "Start the draft",
    note: "No template to choose and nothing to fill in first. Name the book later.",
    href: (id) => `/book/${id}`,
    done: (book) => hasWords(book, 1),
  },
  {
    id: "target",
    phase: "write",
    title: "Set a length to aim at",
    note: "From books that exist rather than the number everybody repeats.",
    href: (id) => `/book/${id}/comps`,
    done: (book) => Boolean(book.targetWords),
  },
  {
    id: "draft",
    phase: "write",
    title: "Finish the first draft",
    note: "The whole thing, badly, before any of it is good. This is the step most books die at.",
    // No detector. "Finished" is a decision, not a word count — a writer at
    // 90% of a target has not finished and one who stopped at 60,000 may have.
  },

  // ---- Revise ------------------------------------------------------------
  {
    id: "readthrough",
    phase: "revise",
    title: "Read it end to end",
    note: "On pages, in order, without editing. You will find things you cannot find any other way.",
    href: (id) => `/book/${id}/read`,
  },
  {
    id: "revise",
    phase: "revise",
    title: "Revise",
    note: "Then stop. If you try to perfect it you will never publish it.",
  },

  // ---- Prepare -----------------------------------------------------------
  {
    id: "title",
    phase: "prepare",
    title: "Check the title",
    note: "Whether somebody else's book turns up first when a reader searches for yours.",
    href: (id) => `/book/${id}/title-check`,
  },
  {
    id: "comps",
    phase: "prepare",
    title: "Find your comp titles",
    note: "Every listing form and every query letter asks for these.",
    href: (id) => `/book/${id}/comps`,
  },
  {
    id: "blurb",
    phase: "prepare",
    title: "Write the blurb",
    note: "The two hundred words that decide whether anybody opens the book.",
    href: (id) => `/book/${id}/blurb`,
    done: (book) => Boolean(book.publishing?.description?.trim()),
  },
  {
    id: "categories",
    phase: "prepare",
    title: "Choose categories",
    note: "These decide which shelf the book turns up on.",
    href: (id) => `/book/${id}/categories`,
    done: (book) => (book.publishing?.subjects?.length ?? 0) > 0,
  },
  {
    id: "cover",
    phase: "prepare",
    title: "Get a cover made",
    note: "The single biggest thing between a good book and no sales. Look at the shelf you are joining first, then pay somebody who can draw.",
    href: (id) => `/book/${id}/covers`,
    // Deliberately not detected from whether artwork is attached: a generated
    // placeholder is attached too, and calling that "done" would tick off the
    // most expensive step in the list on the strength of a gradient.
  },
  {
    id: "author",
    phase: "prepare",
    title: "Decide the name on the cover",
    note: "A pen name is normal, and it is the separation a lot of writers want from the people who know them.",
    done: (book) => Boolean(book.author?.trim()),
  },
  {
    id: "isbn",
    phase: "prepare",
    title: "Sort out an ISBN",
    note: "Shops will give you a free one. Buying your own costs money and means the book is listed as yours rather than theirs.",
    done: (book) => Boolean(book.publishing?.isbn?.trim()),
  },

  // ---- Before you publish ------------------------------------------------
  {
    id: "arc",
    phase: "launch",
    title: "Line up ARC readers — now, not later",
    note: "Advance copies go out weeks before publication so the reviews are there on day one. Almost everybody learns this afterwards, and then spends months trying to get reviews for a book that is already out.",
    /* The step the whole list was arranged around had no destination, while
       the tool that does the work has existed since the Track group shipped.
       No `done`: who holds a copy is a list the writer keeps, and a row in it
       is not the same claim as "the readers are lined up". */
    href: (id) => `/book/${id}/arc`,
  },
  {
    id: "check",
    phase: "launch",
    title: "Run the pre-upload check",
    note: "It names what a shop would refuse, in plain words, before the shop does.",
    href: (id) => `/book/${id}/export`,
  },
  {
    id: "export",
    phase: "launch",
    title: "Export the files",
    note: "EPUB for the shops, PDF at your trim size, DOCX for anyone who asks for Word.",
    href: (id) => `/book/${id}/export`,
  },
  {
    id: "proof",
    phase: "launch",
    title: "Open the files yourself",
    note: "In an e-reader and in Word. Ten minutes here catches what a validator cannot: a broken chapter break, a cover that is upside down.",
  },

  // ---- Publish -----------------------------------------------------------
  {
    /*
     * **Before the upload, because the shop's own form asks on the way in.**
     * A writer who meets this question for the first time in the middle of
     * publishing has to answer it under pressure, about work they finished
     * months ago, with a tick box that carries account-level consequences.
     *
     * No `done`: nothing in a manuscript can tell you how it was written, and
     * guessing would be the worst kind of invented answer. This is the writer's
     * to tick, like the two revision steps.
     */
    id: "ai",
    phase: "publish",
    title: "Answer the AI question honestly",
    note: "Every shop now asks whether AI made any of the text, the images or a translation, and the answer is part of your account rather than the listing. Editing AI text heavily does not make it yours for this purpose. Using AI to brainstorm, research or proofread your own writing is not the same thing and does not have to be declared.",
  },
  {
    id: "upload",
    phase: "publish",
    title: "Upload to the shop",
    note: "We do not do this for you. Amazon has no public API, and anyone automating that dashboard is risking your publishing account rather than theirs.",
  },
  {
    id: "buy",
    phase: "publish",
    title: "Buy your own book",
    note: "One copy, through the shop, like a stranger would. It is the only way to see what a reader actually receives.",
  },
];

/**
 * How many steps work themselves out from the book, and how many are the
 * writer's to tick.
 *
 * Counted from `STEPS` rather than written down anywhere, because four screens
 * quote this split in prose — the roadmap page, the dashboard's Learn area, the
 * tools list and the landing page — and every one of them said "most of it
 * ticks itself" while the truth was the opposite way round. A number typed into
 * four files is a number that will be wrong in at least one of them.
 */
export const SELF_TICKING = STEPS.filter((s) => s.done).length;
export const YOURS_TO_TICK = STEPS.length - SELF_TICKING;

/**
 * `Omit<Step, "done">` because the field changes meaning here: on a `Step` it
 * is the *rule* for working the answer out, and on a `StepState` it is the
 * answer.
 */
export interface StepState extends Omit<Step, "done"> {
  done: boolean;
  /** Whether the tick was worked out, or set by hand. */
  automatic: boolean;
}

/**
 * Every step, with whether it is done.
 *
 * `ticked` is what the writer has marked by hand. A step that can work itself
 * out ignores it — **detected wins over ticked**, so a writer who ticks "write
 * the blurb" and then deletes the blurb sees the step come back. A checklist
 * that can be lied to is a checklist that will be, usually by accident, and
 * then it is worse than nothing.
 */
export function roadmapFor(book: Book, ticked: readonly string[]): StepState[] {
  const byHand = new Set(ticked);
  return STEPS.map((step) => ({
    ...step,
    done: step.done ? step.done(book) : byHand.has(step.id),
    automatic: Boolean(step.done),
  }));
}

export interface Progress {
  done: number;
  total: number;
  /** The next thing to do, or null when the list is finished. */
  next: StepState | null;
}

export function progressOf(steps: StepState[]): Progress {
  const done = steps.filter((s) => s.done).length;
  return {
    done,
    total: steps.length,
    next: steps.find((s) => !s.done) ?? null,
  };
}
