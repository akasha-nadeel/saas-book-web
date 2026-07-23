"use client";

import { ChatPanel } from "@/components/chat/chat-panel";
import { ChapterSidebar } from "@/components/sidebar/chapter-sidebar";
import { BookmarksPanel } from "@/components/editor/bookmarks-panel";
import { NotesPanel } from "@/components/editor/notes-panel";
import { TrashPanel } from "@/components/editor/trash-panel";

/**
 * Whatever the left rail currently points at.
 *
 * The tab strip that used to sit on top is gone: the rail selects the panel
 * now, which is the reference's arrangement and gives the panel its full width
 * back for chapter titles.
 */

export type PanelTab =
  | "chapters"
  | "notes"
  | "bookmarks"
  | "assistant"
  | "trash";

export function LeftPanel({
  tab,
  bookId,
  chapterId,
  chapterTitle,
  getChapterText,
  onClose,
}: {
  tab: PanelTab;
  bookId: string;
  chapterId: string;
  chapterTitle: string;
  getChapterText: () => string;
  /** Dismiss the panel — used by the mobile overlay's backdrop. */
  onClose?: () => void;
}) {
  return (
    <>
      {/* Below md the panel floats over the manuscript rather than taking a
          column from it; this backdrop dims the page and closes on a tap. */}
      <div
        aria-hidden="true"
        onClick={onClose}
        className="fixed inset-0 z-30 bg-black/50 md:hidden"
      />
      <aside
        // The pale half of the two-tone nav; see .panel-chrome. Blue in light,
        // plain dark panel at night. Below md it sits over the page next to the
        // rail; at md and up it's a static column as before.
        className="panel-chrome fixed top-0 bottom-0 left-(--rail-width) z-40 flex
                   w-(--sidebar-width) max-w-[80vw] shrink-0 flex-col border-r
                   border-line md:static md:left-auto md:z-auto md:max-w-none"
        aria-label="Manuscript panel"
      >
      {tab === "chapters" && <ChapterSidebar bookId={bookId} />}
      {tab === "notes" && <NotesPanel key={chapterId} chapterId={chapterId} />}
      {tab === "bookmarks" && <BookmarksPanel bookId={bookId} />}
      {tab === "trash" && <TrashPanel bookId={bookId} />}
      {tab === "assistant" && (
        <>
          <div className="flex h-10 shrink-0 items-center border-b border-line px-4">
            <span className="font-sans text-xs tracking-wide text-muted uppercase">
              Assistant
            </span>
          </div>
          <div className="min-h-0 flex-1">
            <ChatPanel
              chapterTitle={chapterTitle}
              getChapterText={getChapterText}
            />
          </div>
        </>
      )}
      </aside>
    </>
  );
}
