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
  | "history"
  | "trash";

export const PANEL_TITLES: Record<PanelTab, string> = {
  chapters: "Manuscript",
  search: "Search this book",
  consistency: "Consistency check",
  notes: "Notes",
  ideas: "Ideas",
  bible: "Story bible",
  bookmarks: "Bookmarks",
  assistant: "Assistant",
  history: "Versions",
  trash: "Deleted chapters",
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
