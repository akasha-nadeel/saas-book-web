"use client";

import { Rail, RailButton, icons } from "@/components/editor/icon-rail";
import type { PanelTab } from "@/components/editor/left-panel";

/**
 * Picking a panel, from whichever control is asking.
 *
 * Clicking the tab you are already on closes the panel — one control, never
 * two. Exported because the right rail's Assistant button has to obey the
 * same rule as this rail's Assistant tab: they are two controls over one piece
 * of state, and if they disagreed about what a second click does, a writer
 * would learn that the same button behaves differently depending on which edge
 * of the screen they pressed it from.
 */
export function selectPanel(
  value: PanelTab,
  now: { tab: PanelTab; open: boolean },
  set: {
    onSelectTab: (tab: PanelTab) => void;
    onPanel: (open: boolean) => void;
  },
) {
  if (now.open && now.tab === value) {
    set.onPanel(false);
    return;
  }
  set.onSelectTab(value);
  set.onPanel(true);
}

/** The rail's tab buttons — the same order the editor and the overview show. */
const TABS = [
  ["chapters", "Manuscript", icons.chapters],
  ["search", "Search this book", icons.search],
  ["notes", "Notes", icons.notes],
  // Beside Notes, because it is the same gesture aimed elsewhere: notes are
  // about this book, ideas are the ones that are not.
  ["ideas", "Ideas", icons.ideas],
  // Beside Ideas: both are things a writer keeps *about* the book rather than
  // in it, and both are wanted mid-sentence.
  ["bible", "Story bible", icons.bible],
  ["bookmarks", "Bookmarks", icons.bookmarks],
  ["assistant", "Assistant", icons.assistant],
  ["history", "Versions", icons.history],
  ["trash", "Deleted chapters", icons.trash],
] as const;

/**
 * The left rail shared by the chapter editor and the book overview.
 *
 * It selects which panel is open and doubles as the way to hide it: clicking the
 * tab you are already on closes the panel, so there is one control, never two.
 * Both screens want this identical behaviour, so it lives here rather than being
 * copied — a change to the tabs then lands in both places at once.
 *
 * Two tabs are left out where something else already carries them, and both
 * for the same reason — one control, never two:
 *
 * - **Chapters.** In the editor the book panel beside the manuscript already is
 *   a chapter list. The overview has no book panel, so there the tab is the
 *   only way to choose a chapter and stays.
 * - **Assistant.** In the editor the manuscript's own right rail carries it,
 *   next to the tools that act on the page it talks about. The overview has no
 *   right rail — it has no manuscript for one to belong to — so there this tab
 *   is the only way to reach the assistant and stays.
 */
export function WorkspaceRail({
  bookId,
  tab,
  onSelectTab,
  leftPanel,
  onPanel,
  chapters = true,
  assistant = true,
}: {
  bookId: string;
  tab: PanelTab;
  onSelectTab: (tab: PanelTab) => void;
  leftPanel: boolean;
  /** Open or close the panel. Which flag that sets is the screen's business. */
  onPanel: (open: boolean) => void;
  /** Offer the chapter-list tab. False where a book panel already shows one. */
  chapters?: boolean;
  /** Offer the assistant tab. False where the right rail already carries it. */
  assistant?: boolean;
}) {
  const tabs = TABS.filter(
    ([value]) =>
      (chapters || value !== "chapters") &&
      (assistant || value !== "assistant"),
  );

  return (
    <Rail side="left">
      {/* Shown only while the panel is hidden — the way back. When it is open,
          the collapse control in the panel header is what hides it, so there is
          one button, never two. */}
      {!leftPanel && (
        <RailButton label="Show panel" onClick={() => onPanel(true)}>
          {icons.panel}
        </RailButton>
      )}

      <RailButton label="All books" href="/">
        {icons.home}
      </RailButton>

      {/* Read the whole book — every chapter, top to bottom, on one scrolling
          page, as against the single-chapter editor. */}
      <RailButton label="Read the book" href={`/book/${bookId}/read`}>
        {icons.read}
      </RailButton>

      <span aria-hidden="true" className="my-1 h-px w-6 bg-line" />

      {tabs.map(([value, label, icon]) => (
        <RailButton
          key={value}
          label={label}
          // Clicking the panel you are already on closes it, so the rail
          // doubles as the way to get the width back.
          active={leftPanel && tab === value}
          onClick={() =>
            selectPanel(
              value,
              { tab, open: leftPanel },
              { onSelectTab, onPanel },
            )
          }
        >
          {icon}
        </RailButton>
      ))}
    </Rail>
  );
}
