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
  title: "Export",
  note: "Get a clean file out of OpenChapter.",
  tools: [
    {
      path: "export",
      icon: "package",
      name: "Export",
      what: "Word, EPUB or PDF, free on either plan — the file a shop, an agent or an editor asks for.",
    },
  ],
};

/**
 * The things only a whole-book read can find.
 *
 * Its own group rather than a second tool under Export, because the job is a
 * different one: Export is what a writer does when the book is finished, and
 * this is what they do just before deciding that it is.
 */
export const READ_IT_BACK: ToolGroup = {
  title: "Before it goes out",
  note: "The things you cannot catch by reading your own draft.",
  tools: [
    {
      path: "consistency",
      icon: "search",
      name: "Consistency check",
      what: "A name spelled two ways, British and American spellings side by side, straight quotation marks among curly ones — across every chapter at once.",
    },
  ],
};

export const TOOL_GROUPS: ToolGroup[] = [READ_IT_BACK, GET_IT_OUT];

/** Flat, for anything that needs a count or a lookup rather than the grouping. */
export const ALL_TOOLS: BookTool[] = TOOL_GROUPS.flatMap((g) => g.tools);
