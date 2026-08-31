"use client";

import { Rail, RailButton, RailDivider } from "@/components/editor/icon-rail";
import type { MarkName } from "@/components/editor/rail-mark";
import { PANEL_TITLES, type PanelTab } from "@/components/editor/left-panel";

/**
 * Picking a panel, from whichever control is asking.
 *
 * Clicking the tab you are already on closes the panel — one control, never
 * two. Exported because any other surface that opens a panel must obey the
 * same rule as this rail: one panel state, one second-press behavior.
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

/**
 * The rail's tabs, in groups, and the groups are the argument.
 *
 * They were one undivided run of nine — search, notes, ideas, bible,
 * bookmarks, assistant, versions, trash — which is a list to read rather than
 * a shape to learn, and it put the two panels a writer wants *least* often in
 * the middle of the ones they want most. Grouped, the rail can be used by
 * position: near the top is finding your way about the book, below it is the
 * material you keep beside the book, and the two safety nets are at the foot
 * where nothing else will ever be.
 *
 * - **Finding a place in the book** — search, and the places already marked.
 * - **Kept beside the book** — the notes on this chapter, the ideas that are
 *   not this book's, the people and places, and the assistant that reads them.
 * - **The safety nets**, pinned to the foot of the rail: what this chapter used
 *   to say, and what has been deleted. Material Design's rail guidance puts
 *   exactly this class of item in the trailing slot, and for the reason it
 *   matters here: the trash is the one button in the column nobody wants to
 *   press by accident, so it should never be where the eye has learned to find
 *   something else.
 *
 * Names come from `PANEL_TITLES` rather than being written again, so the
 * tooltip on the button and the heading on the panel it opens cannot drift.
 */
const GROUPS: readonly (readonly PanelTab[])[] = [
  ["chapters", "search", "consistency"],
  ["notes", "assistant"],
];

/** Below the rest, always. See the note above. */
const FOOTER: readonly PanelTab[] = ["history", "trash"];

/**
 * Each tab's mark. One per tab and no fallback, so a tab cannot ship without
 * one — the names are `MarkName`s, and `RailMark` owns what each is drawn as.
 */
const TAB_MARKS: Record<PanelTab, MarkName> = {
  chapters: "chapters",
  search: "search",
  consistency: "consistency",
  bookmarks: "bookmarks",
  notes: "notes",
  ideas: "ideas",
  bible: "bible",
  assistant: "assistant",
  history: "history",
  trash: "trash",
};

/**
 * The left rail, which belongs to the editor and to a page being written.
 *
 * It selects which panel is open and doubles as the way to hide it: clicking the
 * tab you are already on closes the panel, so there is one control, never two.
 *
 * One tab is left out where something else already carries it, for the same
 * reason — one control, never two:
 *
 * - **Chapters.** The editor draws the book panel, which already is a chapter
 *   list, so the tab would be the same list twice.
 *
 * The assistant belongs here because it opens the left panel. Keeping the
 * button on the same side as the panel removes the old cross-screen jump from
 * the right rail.
 */
export function WorkspaceRail({
  bookId,
  tab,
  onSelectTab,
  leftPanel,
  onPanel,
  chapters = true,
  chapterSectionOpen,
  onToggleChapters,
  assistant = true,
  className = "",
}: {
  bookId: string;
  tab: PanelTab;
  onSelectTab: (tab: PanelTab) => void;
  leftPanel: boolean;
  /** Open or close the panel. Which flag that sets is the screen's business. */
  onPanel: (open: boolean) => void;
  /** Offer the chapter-list tab. False where a book panel already shows one. */
  chapters?: boolean;
  /** Whether the manuscript chapter section is expanded beside the editor. */
  chapterSectionOpen?: boolean;
  /** Callback to toggle chapter section expansion. */
  onToggleChapters?: (open: boolean) => void;
  /** Offer the assistant tab. False only on screens that intentionally omit AI. */
  assistant?: boolean;
  /** Responsive visibility supplied by the editor shell. */
  className?: string;
}) {
  void bookId;

  const allowed = (value: PanelTab) =>
    (chapters || value !== "chapters") && (assistant || value !== "assistant");

  /**
   * Whether a *tool* panel is on screen — the drawer, not the navigator.
   *
   * The same expression the editor hands `LeftPanel` as its `open`, and it has
   * to stay the same one: the navigator and the drawer share a slot, and this
   * is what decides which of them the writer is actually looking at.
   */
  const toolPanelOpen = leftPanel && tab !== "chapters";

  const tabButton = (value: PanelTab) => {
    const isChapterTab = value === "chapters";
    /* **A tab is lit when it is what is on screen, not when its flag is set.**
       The navigator stays open behind a tool panel — that is deliberate, so
       closing the panel puts the writer back where they were — but it is not
       *visible*, and a rail that lights Manuscript and Find & replace at once
       is a rail claiming the writer is in two places. */
    const isActive = isChapterTab
      ? !!chapterSectionOpen && !toolPanelOpen
      : leftPanel && tab === value;
    const handleClick = () => {
      if (isChapterTab) {
        /* **Manuscript means *show me the navigator*, not *flip a flag*.**
           With a tool panel over it the navigator is open and hidden, so a
           plain toggle shut the one thing the press was asking to see — the
           writer pressed it, the panel stayed, and the cards behind it went
           away. So a press while something is covering it closes the cover
           instead, and only a press while the navigator is the visible thing
           puts it away. Same rule as `selectPanel` above: one control, and its
           second press undoes what its first press did. */
        if (toolPanelOpen) {
          onPanel(false);
          if (!chapterSectionOpen) onToggleChapters?.(true);
          return;
        }
        if (onToggleChapters) {
          onToggleChapters(!chapterSectionOpen);
        } else {
          onPanel(!chapterSectionOpen);
        }
      } else {
        selectPanel(value, { tab, open: leftPanel }, { onSelectTab, onPanel });
      }
    };

    return (
      <span key={value} data-panel-tab={value} className="contents">
        <RailButton
          label={PANEL_TITLES[value]}
          active={isActive}
          onClick={handleClick}
          mark={TAB_MARKS[value]}
        />
      </span>
    );
  };

  const groups = GROUPS.map((group) => group.filter(allowed)).filter(
    (group) => group.length > 0,
  );

  return (
    <Rail
      side="left"
      className={className}
      footer={
        <>
          <RailDivider />
          {FOOTER.filter(allowed).map(tabButton)}
        </>
      }
    >
      {/* **One control, and it moves.**
​
          Shut, the button is here: the rail is all there is. Open, it is at the
          top right of the panel — beside the thing it closes, where a writer's
          eye already is. It is never in both places at once, because two
          buttons doing one job is two things to read and a question about
          whether they differ.

          **The slot is not reserved, and its rule goes with it.** Holding an
          empty box here kept the icons below from shifting when the button left
          — but an invisible 48px box plus the hairline under it is 60-odd
          pixels of nothing at the top of a narrow column, which reads as a rail
          that has failed to load rather than as a rail with a gap in it. The
          rule leaves with the button for the same reason: a divider at the very
          top of a list separates it from nothing. So the column closes up and
          the tabs sit at the top, which is where a writer looks for them. */}
      <RailButton label="All books" href="/" mark="home" />

      {groups.map((group, i) => (
        <div key={i} className="flex flex-col items-center gap-2">
          <RailDivider />
          {group.map(tabButton)}
        </div>
      ))}
    </Rail>
  );
}
