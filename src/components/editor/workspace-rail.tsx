"use client";

import Link from "next/link";
import {
  Rail,
  RailButton,
  RailDivider,
  icons,
} from "@/components/editor/icon-rail";
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
  ["chapters", "search"],
  ["notes", "assistant"],
];

/** Below the rest, always. See the note above. */
const FOOTER: readonly PanelTab[] = ["history", "trash"];

const TAB_ICONS: Record<PanelTab, React.ReactNode> = {
  chapters: icons.chapters,
  search: icons.search,
  bookmarks: icons.bookmarks,
  notes: icons.notes,
  ideas: icons.ideas,
  bible: icons.bible,
  assistant: icons.assistant,
  history: icons.history,
  trash: icons.trash,
};

/**
 * **The way out, standing where the rail would be.**
 *
 * Two screens show a book with no page on it — the book overview, and the
 * editor switched to Book View — and neither carries the rail. Every one of
 * those tabs is something a writer keeps *beside a page they are writing*:
 * search, the notes on this chapter, versions of it. With no page on screen
 * they are nine ways to open a panel about a chapter nobody chose. What such a
 * screen wants in that corner is the way back out, which the rail was burying
 * among them — the same argument that already takes the manuscript's right rail
 * away in Book View.
 *
 * One button rather than a strip: from a book, "back" has a single meaning, the
 * shelf you came from. It is a link rather than `router.back()`, which would
 * send somebody who arrived from a chapter into the chapter again.
 *
 * It takes the rail's **own** width and top inset from `--rail-width` rather
 * than from a padding that happens to add up — that variable steps at three
 * breakpoints, so a hand-measured 4rem box agreed with the rail on medium
 * screens and disagreed on every other one, moving the panel beside it. Living
 * here, next to the rail it stands in for, is what keeps the two screens from
 * drifting apart on the one measurement they share.
 */
export function BackToBooks() {
  return (
    <div className="book-overview-back flex w-(--rail-width) shrink-0 justify-center pt-4">
      <Link
        href="/"
        aria-label="All books"
        title="All books"
        className="flex h-12 w-12 items-center justify-center rounded-xl
                   text-muted outline-none transition-colors hover:bg-raised
                   hover:text-fg focus-visible:ring-2 focus-visible:ring-accent/60"
      >
        <svg
          aria-hidden="true"
          viewBox="0 0 20 20"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="h-5 w-5"
        >
          {icons.home}
        </svg>
      </Link>
    </div>
  );
}

/**
 * The left rail, which belongs to the editor and to a page being written.
 *
 * It selects which panel is open and doubles as the way to hide it: clicking the
 * tab you are already on closes the panel, so there is one control, never two.
 *
 * **It stands down wherever there is no manuscript** — on the book overview, and
 * in the editor's own Book View — and `BackToBooks` above takes its place. See
 * the note there.
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
  /** Responsive visibility supplied by the editor shell. */
  className?: string;
}) {
  void bookId;

  const allowed = (value: PanelTab) =>
    (chapters || value !== "chapters") && (assistant || value !== "assistant");

  const tabButton = (value: PanelTab) => (
    <span key={value} data-panel-tab={value} className="contents">
      <RailButton
        label={PANEL_TITLES[value]}
        // Clicking the panel you are already on closes it, so the rail
        // doubles as the way to get the width back.
        active={leftPanel && tab === value}
        onClick={() =>
          selectPanel(value, { tab, open: leftPanel }, { onSelectTab, onPanel })
        }
      >
        {TAB_ICONS[value]}
      </RailButton>
    </span>
  );

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
      {!leftPanel && (
        <>
          <RailButton label="Show panel" onClick={() => onPanel(true)}>
            {icons.panel}
          </RailButton>
          <RailDivider />
        </>
      )}

      <RailButton label="All books" href="/">
        {icons.home}
      </RailButton>

      {groups.map((group, i) => (
        <div key={i} className="flex flex-col items-center gap-2">
          <RailDivider />
          {group.map(tabButton)}
        </div>
      ))}
    </Rail>
  );
}
