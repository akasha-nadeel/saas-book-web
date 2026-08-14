"use client";

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
  ["chapters", "search", "bookmarks"],
  ["notes", "ideas", "bible", "assistant"],
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
 * - **Chapters.** Both screens draw the book panel, which already is a chapter
 *   list, so the tab would be the same list twice.
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
  const allowed = (value: PanelTab) =>
    (chapters || value !== "chapters") && (assistant || value !== "assistant");

  const tabButton = (value: PanelTab) => (
    <RailButton
      key={value}
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
  );

  const groups = GROUPS.map((group) => group.filter(allowed)).filter(
    (group) => group.length > 0,
  );

  return (
    <Rail
      side="left"
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

      {/* Read the whole book — every chapter, top to bottom, on one scrolling
          page, as against the single-chapter editor. */}
      <RailButton label="Read the book" href={`/book/${bookId}/read`}>
        {icons.read}
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
