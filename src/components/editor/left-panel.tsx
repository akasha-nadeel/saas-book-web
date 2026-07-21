"use client";

import { ChatPanel } from "@/components/chat/chat-panel";
import { ChapterSidebar } from "@/components/sidebar/chapter-sidebar";
import { BookmarksPanel } from "@/components/editor/bookmarks-panel";
import { NotesPanel } from "@/components/editor/notes-panel";

/**
 * Whatever the left rail currently points at.
 *
 * The tab strip that used to sit on top is gone: the rail selects the panel
 * now, which is the reference's arrangement and gives the panel its full width
 * back for chapter titles.
 */

export type PanelTab = "chapters" | "notes" | "bookmarks" | "assistant";

export function LeftPanel({
  tab,
  bookId,
  chapterId,
  chapterTitle,
  getChapterText,
}: {
  tab: PanelTab;
  bookId: string;
  chapterId: string;
  chapterTitle: string;
  getChapterText: () => string;
}) {
  return (
    <aside
      className="flex w-(--sidebar-width) shrink-0 flex-col border-r
                 border-line bg-panel"
      aria-label="Manuscript panel"
    >
      {tab === "chapters" && <ChapterSidebar bookId={bookId} />}
      {tab === "notes" && <NotesPanel key={chapterId} chapterId={chapterId} />}
      {tab === "bookmarks" && <BookmarksPanel bookId={bookId} />}
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
  );
}
