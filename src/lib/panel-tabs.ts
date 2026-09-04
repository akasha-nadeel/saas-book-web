/**
 * What the editor's left panel can be showing, and what each one is called.
 *
 * Its own module, out of `left-panel.tsx`, because three places now need the
 * vocabulary and one of them is `library-store.ts`: which tab is open is a
 * *stored preference*, and a store reaching into a `"use client"` component for
 * a type is the kind of edge that bites a build later.
 *
 * The rail owns the **order** the tabs appear in; this owns the **words**, so
 * the button a writer presses and the panel that opens cannot end up with two
 * different names for one thing.
 */

export type PanelTab =
  | "chapters"
  | "search"
  | "consistency"
  | "notes"
  | "ideas"
  | "bible"
  | "bookmarks"
  | "assistant"
  | "page"
  | "history"
  | "trash";

export const PANEL_TITLES: Record<PanelTab, string> = {
  chapters: "Manuscript",
  search: "Find & replace",
  consistency: "Consistency check",
  notes: "Notes",
  ideas: "Ideas",
  bible: "Story bible",
  bookmarks: "Bookmarks",
  assistant: "Assistant",
  /**
   * The settings that decide how the manuscript looks, and what can be put on
   * it — the book's type, the colour of the paper, a picture, a link.
   *
   * **It exists because the rail had two kinds of button in one column.** The
   * tools that came over from the right-hand rail opened flyouts and dialogs
   * over the page; every other button in the rail opens something at the
   * rail’s edge, and nothing about a glyph said which was which. Gathering
   * them behind one tab makes the rail a single promise again, and it let the
   * sideways-opening flyout go — a portalled menu positioning itself from a
   * trigger rect purely because it used to live on the other edge of the
   * window.
   *
   * **This is the one tab that is not the panel.** It opens as a card at the
   * rail’s edge instead (`tools-popover.tsx`), because a dozen short settings
   * rows in a 25rem full-height column is a panel three-quarters empty that
   * pushes the manuscript sideways to be it. The name is written here with the
   * other nine all the same: what the writer presses is the same kind of
   * button, whatever shape the answer arrives in.
   */
  page: "Page & type",
  history: "Versions",
  trash: "Deleted chapters",
};

/**
 * The same ten, in the words that fit under an icon.
 *
 * **A rail label and a panel heading are different jobs.** The heading has the
 * whole width of the panel and has to say precisely what you are looking at —
 * *Find & replace*, *Deleted chapters*. The label has about five characters of
 * a rail before it wraps or truncates, and it is read at a glance by somebody
 * who already knows what they are reaching for. Squeezing the heading into the
 * rail gives "Consistency ch…", which names nothing.
 *
 * Here rather than in the rail for the reason `PANEL_TITLES` is here: the rail
 * owns the *order*, this owns the *words*, and a second set written in a
 * component is how a button and the panel it opens come to disagree.
 *
 * Where the full title already fits, it is repeated rather than shortened —
 * two names for one thing is worse than a long one.
 */
export const PANEL_RAIL_NAMES: Record<PanelTab, string> = {
  chapters: "Chapters",
  search: "Find",
  consistency: "Check",
  notes: "Notes",
  ideas: "Ideas",
  bible: "Bible",
  bookmarks: "Marks",
  assistant: "Assistant",
  page: "Page",
  history: "Versions",
  trash: "Trash",
};

/**
 * Whether a stored string is still a tab.
 *
 * Read on the way out of storage, like every other pref: this key is written by
 * us and read back a version later, and a tab that has since been renamed would
 * otherwise open a panel with nothing in it.
 */
export function isPanelTab(value: unknown): value is PanelTab {
  return typeof value === "string" && value in PANEL_TITLES;
}
