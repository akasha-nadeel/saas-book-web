"use client";

import { usePathname } from "next/navigation";
import { BookPanel, useOpenPart } from "@/components/editor/book-panel";
import { findBook } from "@/lib/library-store";
import { useCover, usePrefs, useShelf } from "@/lib/use-library";

/**
 * The chapter and matter pages sidebar navigator.
 *
 * Renders the same 3-matter-cards BookPanel navigator (front matter, body,
 * and back matter), with chapter switching and section imports.
 */
export function ChapterSidebar({
  bookId,
  onNavigate,
  onClose,
  connectToPage = false,
}: {
  bookId: string;
  onNavigate?: () => void;
  onClose?: () => void;
  /**
   * Whether the open chapter’s card runs its two rules out to the manuscript.
   *
   * Off unless asked for: this navigator is also mounted on screens with no
   * page beside it for the rules to land on, and a pair of them pointing into
   * empty space is a diagram of nothing.
   */
  connectToPage?: boolean;
}) {
  const shelf = useShelf();
  const book = findBook(shelf, bookId);
  const prefs = usePrefs();
  const cover = useCover(bookId);
  const body = useOpenPart();
  const pathname = usePathname();

  const prefix = `/book/${bookId}/chapter/`;
  const activeId = pathname.startsWith(prefix)
    ? decodeURIComponent(pathname.slice(prefix.length))
    : null;

  if (!book) return null;

  return (
    <div className="h-full w-full">
      <BookPanel
        book={book}
        chapterId={activeId}
        cover={cover}
        paper={prefs.paper}
        body={body}
        always
        /* **The rules reach the paper from in here too.** They are drawn in a
           body-level portal precisely so being inside a scrolling panel cannot
           clip them, and this is where the navigator lives now. */
        connectToPage={connectToPage}
        onNavigate={onNavigate}
        /* **No dismiss passed, so the navigator draws none.** The panel around
           it already carries the control that shuts it, and two of them a foot
           apart is a question about whether they differ. Where this component
           is somebody’s only surface, the caller says so with `onClose`. */
        onClose={onClose}
        className="flex h-full w-full flex-col bg-white dark:bg-transparent"
      />
    </div>
  );
}
