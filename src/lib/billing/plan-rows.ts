/**
 * Every line the two plans are compared on, and what each one gives.
 *
 * **Its own module, with no `"use client"` on it, and that is load-bearing.**
 * The pricing cards are drawn on `/upgrade`, which is a client component, and
 * on the landing page, which is a Server Component — and a `"use client"`
 * module's exports become client *references*, so a Server Component importing
 * this array would get `.map` of a reference object and the page would 500.
 * The rule is written down in CLAUDE.md; this is the file it was written for.
 *
 * **Every number is read, never typed.** The counts come from `LAUNCH_LIMITS`
 * and `FREE_LIMITS`, which are the same constants the gates enforce, so the
 * pricing page cannot promise something the app then refuses.
 */

import { LAUNCH_LIMITS } from "@/lib/launch";
import { FREE_LIMITS } from "@/lib/free-limits";
import { plural } from "@/lib/plural";

/**
 * The one value that means "no". Named, because the mark in front of a row is
 * chosen by comparing against it — a tick beside the words "Not included" is a
 * yes and a no in the same line.
 */
export const NOT_INCLUDED = "Not included";

/**
 * The three headings the rows are filed under, in the order a book is made.
 *
 * **Twenty-two rows in one column is a list nobody finishes.** That was the
 * shape of this card until now, and the order inside it had no argument at all
 * — the three Pro-only rows sat in the middle, "Prose report" came after
 * "Audiobook", and the writing record landed under the sales curve. A reader
 * scanning for the one thing they came to check had to read every line.
 *
 * Grouping is what the pricing pages that carry this many rows do (Airtable and
 * Notion both file theirs under headings), and for a measurable reason: nobody
 * reads a long feature list, they scan for their own question, and a heading is
 * what tells them which ten lines to look at. It also stops the list reading as
 * a boast — clarity over completeness.
 *
 * **The headings are the job, not the software's parts.** "Writing the book",
 * "Getting it ready", "Selling it" is the same order the roadmap walks and the
 * same claim the landing page makes: nobody tells you the order. A reader who
 * has only written should be able to see where they are on this card.
 */
export const GROUPS = ["Core workspace", "AI and export"] as const;

export type Group = (typeof GROUPS)[number];

export const ROWS: {
  group: Group;
  label: string;
  detail?: string;
  starter: string;
  pro: string;
}[] = [
  {
    group: "Core workspace",
    label: "Books",
    starter: plural(LAUNCH_LIMITS.freeBooks, "book"),
    pro: "Unlimited",
  },
  {
    group: "Core workspace",
    label: "Chapters and words",
    starter: "Unlimited",
    pro: "Unlimited",
  },
  {
    group: "Core workspace",
    label: "Autosave and sync",
    starter: "Included",
    pro: "Included",
  },
  {
    group: "Core workspace",
    /* **Filed here rather than under a heading of its own.** It is research
       rather than workspace, strictly — but a third heading on a card this
       tall costs more than the tidiness is worth, and the row reads perfectly
       well beside the other things a writer gets a fixed amount of.

       Both numbers are read from `FREE_LIMITS`, which is what `useLimitGate`
       spends, so this page cannot promise a count the screen then refuses.
       `pro: null` there means no ceiling, which is the one value `badgeTone`
       paints gold. */
    label: "Title check",
    detail: "Search millions of published titles.",
    starter: `${FREE_LIMITS.titleCheck.free} a day`,
    pro: "Unlimited",
  },
  {
    group: "AI and export",
    label: "Writing assistant",
    starter: `${LAUNCH_LIMITS.freeAssistantRepliesPerMonth} replies / month`,
    pro: `${LAUNCH_LIMITS.proAssistantRepliesPerMonth} replies / month`,
  },
  {
    group: "AI and export",
    /* **A capability row among the counts, and the wording is the whole of it.**
       What Pro buys is the assistant *offering* a passage for the page; the
       change is still the writer's press, and the row has to read that way or
       it is selling something the app does not do. */
    /* Plain, and the same sentence on both cards — the mark in front is what
       differs. "The assistant writes into your chapter" read as a description
       of something happening on its own; "can write in" is the permission it
       actually is, which is also the honest word: nothing goes into the page
       without the writer pressing for it. */
    label: "The assistant can write in your chapter",
    /* **The one cross on the page, and it used to be a tick.**

       This row carried a green mark on the free card with the value "It offers
       text to copy" — which is a true sentence about the free assistant and a
       false answer to the row it is answering. `LAUNCH_LIMITS.freeAssistantWrite`
       is `false` and `/api/chat` gates write mode with `requirePro()`: the free
       plan does not write into the chapter, and a tick beside a line saying it
       does is the worst claim this app can make, on the page a sceptical reader
       checks hardest.

       `NOT_INCLUDED` is what the card compares against to draw a cross instead,
       and it prints no badge — see the note on `ValueBadge`. One cross across
       two columns is what makes it impossible to miss. */
    starter: NOT_INCLUDED,
    /* **"Included", so the tick carries it and no badge is drawn.** The value
       was "Replace or insert, on your press" — accurate, and a sentence where
       every other badge on the card is a count. A badge is for a *figure* a
       reader scans for; a capability that is simply present is what the mark in
       front of the label already says, which is why "Included" is dropped
       rather than printed. The cross opposite is what makes the row land. */
    pro: "Included",
  },
  {
    group: "AI and export",
    /* **The same on both sides, and that is the row doing its job.** Export was
       the one thing Pro bought that a writer cannot do without, and charging
       for the door is the thing this trade's writers check for first. The row
       stays rather than coming out: a reader comparing the columns should be
       able to see that the file is not what they are paying for.

       The label is matched by string in `STARTER_HIGHLIGHT` below — renaming it
       silently drops the highlight. */
    label: "Export",
    detail: "Word, EPUB and PDF, on either plan.",
    starter: "Word, EPUB, PDF",
    pro: "Word, EPUB, PDF",
  },
];
