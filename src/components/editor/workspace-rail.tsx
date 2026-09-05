"use client";

import { Rail, RailButton, RailDivider } from "@/components/editor/icon-rail";
import type { MarkName } from "@/components/editor/rail-mark";
import { PANEL_TITLES, type PanelTab } from "@/components/editor/left-panel";
import { PANEL_RAIL_NAMES } from "@/lib/panel-tabs";

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
  /* **How the page looks, and what goes on it.** Its own group because it is
     the one tab that changes the *book* rather than telling you about it —
     everything above reads the manuscript back to the writer, and this sets
     the type it is read in.

     It is also what let the right-hand rail go. Those controls opened flyouts
     over the page, so half this column would have opened the panel beside it
     and half something over the manuscript, with nothing about a glyph to say
     which. Behind a tab they are one kind of button again. */
  ["page"],
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
  page: "tools",
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
  assistant = true,
  toolsOpen = false,
  onTools,
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
  /** Offer the assistant tab. False only on screens that intentionally omit AI. */
  assistant?: boolean;
  /**
   * Whether the tools strip is on screen, and how to open it.
   *
   * **The one tab that does not open the panel**, and the rail has to know it:
   * the settings come out as a card at this rail’s edge instead. It is still a
   * tab and not a second kind of button — it lights when it is showing, its
   * second press puts it away, and pressing anything else swaps to that — so
   * the rail keeps its one promise. Only where the answer appears differs.
   *
   * Left out on a screen that passes neither, which is how the tab is offered
   * only where something can host the card.
   */
  toolsOpen?: boolean;
  onTools?: (open: boolean) => void;
  /** Responsive visibility supplied by the editor shell. */
  className?: string;
}) {
  void bookId;

  const allowed = (value: PanelTab) =>
    (chapters || value !== "chapters") &&
    (assistant || value !== "assistant") &&
    (!!onTools || value !== "page");

  /**
   * **Every tab is an ordinary tab now, Manuscript included.**
   *
   * It used to be the exception, and the exception was expensive. The
   * navigator was a panel of its own in a slot of its own on a stored flag of
   * its own, so this button did not select a tab at all — it toggled that
   * flag, and had to know that a tool panel *covering* the navigator meant a
   * press should close the cover rather than the thing under it, and that a
   * lit Manuscript beside a lit Find & replace would be the rail claiming the
   * writer was in two places. All of it existed to make one button behave like
   * the other nine. It is the `chapters` tab of the one panel now, and none of
   * it is needed.
   */
  const tabButton = (value: PanelTab) => {
    /* **The tools strip stands in the panel's slot, so one of them is on
       screen and never both.** Tools reads its own flag; every other tab is
       lit only while that strip is away.

       **And pressing one has to put it away**, which is the half that was
       missing: `selectPanel` opened the panel behind a strip that went on
       covering it, so the panel stayed hidden *and* the tab could not light,
       and the whole column read as dead. A press on a tab is a request to see
       that tab. */
    const isActive =
      value === "page" ? toolsOpen : !toolsOpen && leftPanel && tab === value;
    const handleClick = () => {
      if (value === "page") {
        /* Same second-press rule as every other tab, pointed at the strip. */
        onTools?.(!toolsOpen);
        return;
      }
      onTools?.(false);
      selectPanel(value, { tab, open: leftPanel }, { onSelectTab, onPanel });
    };

    return (
      <span key={value} data-panel-tab={value} className="contents">
        <RailButton
          label={PANEL_TITLES[value]}
          name={PANEL_RAIL_NAMES[value]}
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

      {/* **The first group draws no rule.** A divider at the top of a list
          separates it from nothing, and the way out to the shelf that used to
          stand above this one is in the bar now — one home, not two. */}
      {groups.map((group, i) => (
        <div key={i} className="flex w-full flex-col items-center gap-1">
          {i > 0 && <RailDivider />}
          {group.map(tabButton)}
        </div>
      ))}
    </Rail>
  );
}
