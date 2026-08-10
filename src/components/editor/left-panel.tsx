"use client";

import { useEffect, useRef, useState } from "react";
import { ChatPanel } from "@/components/chat/chat-panel";
import { ChapterSidebar } from "@/components/sidebar/chapter-sidebar";
import { BookmarksPanel } from "@/components/editor/bookmarks-panel";
import { HistoryPanel } from "@/components/editor/history-panel";
import { BiblePanel } from "@/components/editor/bible-panel";
import { IdeasPanel } from "@/components/editor/ideas-panel";
import { NotesPanel } from "@/components/editor/notes-panel";
import { TrashPanel } from "@/components/editor/trash-panel";
import { SearchPanel } from "@/components/editor/search-panel";
import { icons } from "@/components/editor/icon-rail";

/**
 * Whatever the left rail currently points at.
 *
 * **It floats over the manuscript rather than pushing it.** It was a static
 * column at `md` and up, which meant opening Search or the story bible slid the
 * whole book — panel, sheet, right rail — 15rem to the right, and closing it
 * slid everything back. That is the wrong trade for a writing app: the sentence
 * being read moves under the eye, the paragraph re-wraps at a new column width,
 * and the page's own left edge is no longer where the writer left it. These
 * panels are *consulted* — a search, a note, a name from the bible — and then
 * dismissed, and a surface you glance at should not reflow the one you are
 * working in. Every content-first editor lands in the same place (VS Code's
 * overlay mode, Scrivener's floating inspector), for the same reason: on a
 * content app the screen is the content's, and navigation borrows it.
 *
 * Two things follow from floating, and both are handled here. It carries a
 * shadow, because a layer over another layer has to say it is over it — a
 * flat-edged panel sitting on the page reads as a column that failed to push.
 * And it can be dismissed without hunting: **the rail's tab, this header's own
 * control, and Escape** all close it.
 *
 * **One header for all nine tabs.** Four of them drew their own and five drew
 * none, so the panel's top edge moved depending on which tab you were on, and
 * only some of them said what you were looking at. It is a single row now —
 * the panel's name, and the control that hides it — and the sub-panels below
 * render their contents only.
 */

export type PanelTab =
  | "chapters"
  | "search"
  | "notes"
  | "ideas"
  | "bible"
  | "bookmarks"
  | "assistant"
  | "history"
  | "trash";

/**
 * What each panel is called, in one place.
 *
 * Read by the rail for its tooltips and by the header below for its title, so
 * the button a writer presses and the panel that opens cannot end up with two
 * different names for one thing. The rail owns the *order*; this owns the
 * words.
 */
/**
 * What each panel is *about*, where the name does not already say it.
 *
 * **Two of these panels are text boxes sitting next to each other in the rail,
 * and nothing on either said what it belonged to.** Notes are per *chapter* —
 * a synopsis and things to fix on the page you are on — and the parking lot is
 * per *library*, holding the book you are not writing. Both read as "somewhere
 * to type things you keep beside the book", both are a plain box under a
 * one-word heading, and a writer with something to jot down had no way to tell
 * from the panel which one they were in. The two are one debounced save apart
 * from putting a note about Chapter 3 somewhere it will never be looked for.
 *
 * So the scope is said out loud, and the chapter's is the writer's own words
 * rather than ours — which is why it is **not** uppercased with the heading
 * beside it: a page called "Chapter 3" is not called "CHAPTER 3", and a panel
 * that shouts somebody's title back at them has misquoted it.
 *
 * Blank for the panels whose name already carries it ("Search this book",
 * "Deleted chapters") — a scope line on every tab would be a row of noise, and
 * the two that need it would stop standing out.
 */
function panelScope(tab: PanelTab, chapterTitle: string): string | null {
  if (tab === "notes") return chapterTitle.trim() || null;
  if (tab === "ideas") return "all books";
  return null;
}

export const PANEL_TITLES: Record<PanelTab, string> = {
  chapters: "Manuscript",
  search: "Search this book",
  notes: "Notes",
  ideas: "Ideas",
  bible: "Story bible",
  bookmarks: "Bookmarks",
  assistant: "Assistant",
  history: "Versions",
  trash: "Deleted chapters",
};

/** How long the drawer takes to leave. Matches `.oc-drawer-out` in globals.css. */
const EXIT_MS = 180;

export function LeftPanel({
  open,
  tab,
  bookId,
  chapterId,
  chapterTitle,
  getChapterText,
  onClose,
}: {
  /**
   * Whether the panel should be showing.
   *
   * **Taken as a prop rather than left to the caller's `{open && …}`, because a
   * panel removed from the tree cannot animate its own exit.** It slid in and
   * then vanished on the frame it was closed, which reads as two different
   * mechanisms for one gesture. Owning the flag lets it stay mounted for the
   * length of the way out and then take itself down.
   *
   * Nothing mounts before the first open: `rendered` starts false and the whole
   * component returns null, so a writer who never opens a panel never pays for
   * the bible, the assistant or the history reading storage.
   */
  open: boolean;
  tab: PanelTab;
  bookId: string;
  chapterId: string;
  chapterTitle: string;
  getChapterText: () => string;
  /** Dismiss the panel. Required: the header's control and Escape both need it. */
  onClose: () => void;
}) {
  const scope = panelScope(tab, chapterTitle);
  const fullName = scope
    ? `${PANEL_TITLES[tab]} — ${scope}`
    : PANEL_TITLES[tab];

  /*
   * A press anywhere else puts it away.
   *
   * This is what a floating panel owes the page it is floating over: it is
   * consulted and then dismissed, and the dismissal should be the gesture you
   * were making anyway — reaching back into the manuscript. Hunting for a
   * control to close a layer you have already stopped looking at is the part
   * that made the pushed column feel like furniture.
   *
   * **Both rails are excluded, and that is not a nicety.** They hold the
   * controls that open and close this thing, so a press on the tab you are
   * already on would close the panel here on `pointerdown` and then be opened
   * straight back up by the `click` behind it — the toggle would look broken in
   * the one place a writer uses it most.
   *
   * `pointerdown` rather than `click`, so the panel is on its way out as the
   * press lands rather than on release; and in the capture phase, so a handler
   * that stops propagation somewhere in the page cannot leave the panel
   * standing open.
   *
   * `onClose` is read through a ref because both callers pass an inline arrow —
   * naming it as a dependency would tear the listener down and put it back on
   * every render of the editor, which is every keystroke.
   */
  const panelRef = useRef<HTMLElement>(null);
  const close = useRef(onClose);
  useEffect(() => {
    close.current = onClose;
  });

  useEffect(() => {
    // Only while it is showing. Left armed on a closed panel this would call
    // `onClose` on every press anywhere in the app, which is a state set React
    // discards but a listener nobody asked for.
    if (!open) return;

    const onPointerDown = (e: PointerEvent) => {
      const target = e.target;
      if (!(target instanceof Element)) return;
      if (panelRef.current?.contains(target)) return;
      if (target.closest("[data-rail]")) return;
      close.current();
    };
    document.addEventListener("pointerdown", onPointerDown, true);
    return () =>
      document.removeEventListener("pointerdown", onPointerDown, true);
  }, [open]);

  /*
   * Mounted a beat longer than it is open, so it has time to leave.
   *
   * Set straight to true on the way in — waiting a frame would cost the
   * entrance its first frame — and dropped on a timer on the way out that is
   * the exit animation's own length. If it is reopened mid-exit the timer is
   * cleared by the cleanup and the `in` class replaces the `out` one, so a
   * writer who changes their mind halfway gets the panel back rather than a
   * flicker.
   */
  const [rendered, setRendered] = useState(open);
  // Opening is adjusted during render rather than in an effect — React's own
  // "adjusting state when a prop changes" — because an effect would paint one
  // frame of nothing first and the entrance would start a frame late.
  if (open && !rendered) setRendered(true);

  useEffect(() => {
    if (open) return;
    const timer = window.setTimeout(() => setRendered(false), EXIT_MS);
    return () => window.clearTimeout(timer);
  }, [open]);

  if (!rendered) return null;

  return (
    <>
      {/* Below md the panel takes most of the window, so the page behind it is
          dimmed and a tap anywhere on it closes. Above md it is a light layer
          over a page the writer can still read, and dimming the manuscript to
          show a search box would be the heavier gesture of the two. */}
      <div
        aria-hidden="true"
        onClick={onClose}
        className={`fixed inset-0 z-30 bg-black/50 md:hidden ${
          open ? "oc-scrim-in" : "oc-scrim-out"
        }`}
      />
      <aside
        ref={panelRef}
        // Floating at every width — see the note above. `fixed` rather than
        // absolute because the rail is against the window's own left edge, so
        // `left-(--rail-width)` is measured from the same origin at any scroll
        // position, and the panel runs the full height of the window rather
        // than the height of whatever flex row it was dropped into.
        // `pointer-events-none` on the way out: it is still on screen for the
        // length of the slide, and a press that lands on a panel already
        // leaving is a press on something the writer has dismissed.
        className={`panel-chrome fixed top-0 bottom-0 left-(--rail-width) z-40
                    flex w-(--sidebar-width) max-w-[80vw] flex-col border-r
                    border-line shadow-2xl md:max-w-none ${
                      open
                        ? "oc-drawer-in"
                        : "oc-drawer-out pointer-events-none"
                    }`}
        aria-label={fullName}
        // Escape closes it, but only from inside: this is a layer over the
        // manuscript rather than a modal, so a writer typing in the page must
        // be able to press Escape without the panel they are reading from
        // disappearing.
        onKeyDown={(e) => {
          if (e.key === "Escape") {
            e.stopPropagation();
            onClose();
          }
        }}
      >
        {/* The panel's own name, and the way to put it away.

            **Top right, which is where a floating panel's dismissal belongs**
            and where VS Code, Linear and Notion all put theirs. The rail's tab
            closes it too — pressing the tab you are on is still the shortest
            way — but a writer whose eye is *in* the panel should not have to
            travel back to the edge of the window to be rid of it. The two
            controls are one toggle, so they can never disagree. */}
        <header className="flex h-11 shrink-0 items-center gap-2 border-b border-line pr-1.5 pl-4">
          {/* The name never shrinks and the scope does. At 15rem a long chapter
              title would otherwise eat the word telling you which panel you are
              in, which is the half that has to survive. `title` carries the
              whole of it for anything the ellipsis takes. */}
          <h2
            title={fullName}
            className="flex min-w-0 flex-1 items-baseline gap-1.5 font-sans text-xs font-semibold"
          >
            <span className="shrink-0 tracking-wide text-muted uppercase">
              {PANEL_TITLES[tab]}
            </span>
            {scope && (
              <span className="min-w-0 truncate font-medium text-muted/75">
                <span aria-hidden="true">· </span>
                {scope}
              </span>
            )}
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Hide panel"
            title="Hide panel"
            className="flex h-8 w-8 shrink-0 items-center justify-center
                       rounded-lg text-muted outline-none transition-colors
                       hover:bg-raised hover:text-fg focus-visible:ring-2
                       focus-visible:ring-accent/60"
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
              {icons.panel}
            </svg>
          </button>
        </header>

        <div className="min-h-0 flex-1">
          {tab === "chapters" && <ChapterSidebar bookId={bookId} />}
          {tab === "search" && <SearchPanel bookId={bookId} />}
          {tab === "notes" && (
            <NotesPanel key={chapterId} chapterId={chapterId} />
          )}
          {tab === "ideas" && <IdeasPanel bookId={bookId} />}
          {tab === "bible" && (
            <BiblePanel bookId={bookId} chapterId={chapterId} />
          )}
          {tab === "bookmarks" && <BookmarksPanel bookId={bookId} />}
          {tab === "history" && (
            <HistoryPanel key={chapterId} bookId={bookId} chapterId={chapterId} />
          )}
          {tab === "trash" && <TrashPanel bookId={bookId} />}
          {tab === "assistant" && (
            <ChatPanel
              chapterTitle={chapterTitle}
              getChapterText={getChapterText}
            />
          )}
        </div>
      </aside>
    </>
  );
}
