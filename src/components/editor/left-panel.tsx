"use client";

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

export type PanelTab = "chapters" | "notes" | "bookmarks";

export function LeftPanel({
  tab,
  bookId,
  chapterId,
}: {
  tab: PanelTab;
  bookId: string;
  chapterId: string;
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
    </aside>
  );
}
