/**
 * Every per-book tool, named and explained, in one list.
 *
 * Two screens need this: the sheet a book card's ⋯ menu opens, and the Tools
 * area of the dashboard. They were about to hold two copies of the same sixteen
 * descriptions, which is two copies to keep in step and one to forget — the
 * kind of duplication that goes stale silently and then tells a writer a
 * feature does something it stopped doing a release ago.
 *
 * It is data rather than components so both sides can shape it their own way,
 * and so the *descriptions* — which are claims about what the product does, and
 * therefore held to the same rule as the landing page — live somewhere a person
 * can read them all at once and check.
 *
 * **Everything here is built and works.** Nothing is a preview, and none of it
 * is gated behind a plan. A tool that is not finished does not go in this list;
 * it goes in `PLANNED` on the dashboard, as a card that plainly says so.
 */

import { SELF_TICKING } from "./roadmap";

export interface BookTool {
  /** Appended to `/book/<id>/`. */
  path: string;
  name: string;
  /** What it does, in the writer's terms rather than the roadmap's. */
  what: string;
  /**
   * Which glyph to draw. A name rather than the drawing itself, so this file
   * stays free of JSX and can be read as a list of what the product does —
   * `tool-grid.tsx` holds the paths.
   */
  icon: string;
}

export interface ToolGroup {
  title: string;
  /** The one thing worth knowing about the whole group. */
  note: string;
  tools: BookTool[];
}

/*
 * Each group used to carry a hue, and every card in it was tinted with that
 * hue — the eye found the block it wanted by colour before it read a word. The
 * palette is greyscale now, so the field is gone rather than left pointing at
 * nothing. The heading, the note and the group's own ruled block carry it, and
 * that was always the fallback for anyone who could not tell the hues apart.
 */

/**
 * The three tools that get a finished book out.
 *
 * Named, and part of `TOOL_GROUPS` below rather than a copy of it, because the
 * dashboard's Overview shows this one group on its own — that screen's job is
 * "what stands between your book and a shop", and these are the answers to the
 * second half of it. A lookup by title would have worked until somebody
 * renamed the group, and then the block would vanish from the Overview with
 * nothing failing anywhere. One definition, two readers.
 */
export const GET_IT_OUT: ToolGroup = {
  title: "Get it out",
  note: "The parts a shop sees.",
  tools: [
    {
      path: "export",
      icon: "package",
      name: "Export and publish",
      what: "EPUB, DOCX, Markdown and a print PDF — and what a shop would refuse before you upload it.",
    },
    {
      path: "roadmap",
      icon: "compass",
      name: "What to do next",
      what: `Every step in the order it happens, with the ${SELF_TICKING} that tick themselves from your book already marked.`,
    },
    {
      path: "listing",
      icon: "form",
      name: "Listing details",
      // Was reachable only through the export flow, four steps in and behind a
      // format choice. These are facts about the book, not about an export.
      what: "The ISBN, language, publisher, date and series a shop asks for — answered once, on the book.",
    },
    {
      path: "paperback",
      icon: "ruler",
      name: "Paperback setup",
      what: "Trim size, margins and the spine width for the page count you actually have.",
    },
  ],
};

export const TOOL_GROUPS: ToolGroup[] = [
  GET_IT_OUT,
  {
    title: "Find your shelf",
    /* **Was "Nothing you have written is sent", which this group cannot
       promise.** Two of its screens send words the writer wrote: a comps or
       blurb search carries up to five keywords lifted from the saved blurb,
       and the Pro ranking sends the blurb and the opening of the manuscript —
       the second route in the whole app that sends prose. A blanket assurance
       here is read before any of those screens is opened, which is the worst
       place to be wrong about it.
       So the guarantee moves to where it can be kept: each screen lists what
       leaves, above the button, before it is pressed. */
    note: "Read from Google Books and Open Library. Each screen says what it sends before you press.",
    tools: [
      {
        path: "comps",
        icon: "shelf",
        name: "Comp titles",
        // Names the job, not the term. "The published books yours sits beside"
        // was the old opening here and in the screen's own deck, and it only
        // reads to somebody who already knows what a comp is — who is exactly
        // the writer not looking for this tile. This line is read *before* the
        // screen is opened, so it is the one place the jargon costs most.
        what: "Real published books like yours, for the two or three every listing form and agent letter makes you name — ranked, on request, by a model that reads your opening.",
      },
      {
        path: "blurb",
        icon: "quote",
        name: "Blurb",
        // No longer "and shown real blurbs from books like yours": those
        // examples were removed on 2026-08-04 for returning classics rather
        // than comparable titles. A tile promising a panel that is not there
        // is the tile version of dead UI.
        what: "Counted against the shops’ limits, with what is unusual about it named.",
      },
      {
        path: "categories",
        icon: "tag",
        name: "Categories & keywords",
        // Twice narrowed, and the description follows the screen both times.
        // The subject search was pulled on 2026-08-04 to get a release out, and
        // on 2026-08-11 the categories half went with it, to be rebuilt — so
        // what ships today is the seven boxes and the checker. The name keeps
        // both words because the roadmap step and the dashboard finding still
        // land here; the sentence may only claim what is on the screen. Put
        // each half back as it returns, and not before.
        what: "The seven keyword boxes a shop asks for, counted and checked against what your listing already says.",
      },
      {
        path: "covers",
        icon: "image",
        name: "Covers",
        // Twice rewritten on 2026-08-11 and back to nearly where it started:
        // the "Yours" panel came off the screen, so the "beside the shelf"
        // half stopped being true, and then the cover went into the wall
        // itself, which made it true again in a stronger sense. The size is no
        // longer named, because the wall opens at Large and the writer picks.
        what: "Yours in the shelf it competes on, at the size a reader meets it — and a check on the file itself.",
      },
      {
        path: "title-check",
        icon: "search",
        name: "Title check",
        what: "Whether somebody else’s book turns up first when a reader searches for yours.",
      },
    ],
  },
  {
    title: "The writing",
    note: "About the manuscript rather than the listing.",
    tools: [
      {
        path: "structure",
        icon: "arc",
        name: "Structure",
        what: "The shape most novels share, with your word count placed on it. A convention, not a rule.",
      },
      {
        path: "prose",
        icon: "lines",
        name: "Prose report",
        what: "What is in a chapter, counted. No score, and it never changes a word.",
      },
      {
        path: "progress",
        icon: "trend",
        name: "Progress",
        what: "Whether the writing is moving, and roughly when it finishes at this pace.",
      },
      {
        path: "provenance",
        icon: "shield",
        name: "Writing record",
        what: "The trail the work left, in a document you can send if you are ever accused.",
      },
    ],
  },
  {
    title: "Money and reviews",
    note: "What happens once it is out.",
    tools: [
      {
        path: "money",
        icon: "wallet",
        name: "Before you spend",
        what: "What covers, editing and promotion cost, and what to establish before the money moves.",
      },
      {
        path: "track",
        icon: "coins",
        name: "Track",
        what: "What this book cost against what it earned, and how many copies get you level.",
      },
      {
        path: "arc",
        icon: "send",
        name: "Advance copies",
        what: "Who holds one, who reviewed, and when each review is wanted. One list instead of six sites.",
      },
    ],
  },
];

/** Flat, for anything that needs a count or a lookup rather than the grouping. */
export const ALL_TOOLS: BookTool[] = TOOL_GROUPS.flatMap((g) => g.tools);
