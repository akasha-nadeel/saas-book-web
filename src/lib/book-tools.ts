/**
 * Every per-book tool, named and explained, in one list.
 *
 * Two screens need this: the sheet a book card's ⋯ menu opens, and the Tools
 * area of the dashboard. They were about to hold two copies of the same fifteen
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

export interface BookTool {
  /** Appended to `/book/<id>/`. */
  path: string;
  name: string;
  /** What it does, in the writer's terms rather than the roadmap's. */
  what: string;
}

export interface ToolGroup {
  title: string;
  /** The one thing worth knowing about the whole group. */
  note: string;
  tools: BookTool[];
}

export const TOOL_GROUPS: ToolGroup[] = [
  {
    title: "Get it out",
    note: "The parts a shop sees.",
    tools: [
      {
        path: "export",
        name: "Export and publish",
        what: "EPUB, DOCX, Markdown and a print PDF — and what a shop would refuse before you upload it.",
      },
      {
        path: "roadmap",
        name: "What to do next",
        what: "Every step in the order it happens. Most of it ticks itself from what is already in the book.",
      },
      {
        path: "paperback",
        name: "Paperback setup",
        what: "Trim size, margins and the spine width for the page count you actually have.",
      },
    ],
  },
  {
    title: "Find your shelf",
    note: "Read from Google Books and Open Library. Nothing you have written is sent.",
    tools: [
      {
        path: "comps",
        name: "Comp titles",
        what: "The published books yours sits beside, which every listing form and query letter asks for.",
      },
      {
        path: "blurb",
        name: "Blurb",
        what: "Counted against the shops’ limits, and shown real blurbs from books like yours.",
      },
      {
        path: "categories",
        name: "Categories",
        what: "Which shelf you land on, worked out from where comparable books are filed.",
      },
      {
        path: "covers",
        name: "Covers",
        what: "Yours at thumbnail size beside the shelf it competes on, and a check on the file itself.",
      },
      {
        path: "title-check",
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
        name: "Structure",
        what: "The shape most novels share, with your word count placed on it. A convention, not a rule.",
      },
      {
        path: "prose",
        name: "Prose report",
        what: "What is in a chapter, counted. No score, and it never changes a word.",
      },
      {
        path: "progress",
        name: "Progress",
        what: "Whether the writing is moving, and roughly when it finishes at this pace.",
      },
      {
        path: "provenance",
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
        name: "Before you spend",
        what: "What covers, editing and promotion cost, and what to establish before the money moves.",
      },
      {
        path: "track",
        name: "Track",
        what: "What this book cost against what it earned, and how many copies get you level.",
      },
      {
        path: "arc",
        name: "Advance copies",
        what: "Who holds one, who reviewed, and who is late. One list instead of six sites.",
      },
    ],
  },
];

/** Flat, for anything that needs a count or a lookup rather than the grouping. */
export const ALL_TOOLS: BookTool[] = TOOL_GROUPS.flatMap((g) => g.tools);
