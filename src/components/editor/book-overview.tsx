"use client";

import { useState } from "react";
import Link from "next/link";
import { WorkspaceRail } from "@/components/editor/workspace-rail";
import { LeftPanel, type PanelTab } from "@/components/editor/left-panel";
import { BookGuide } from "@/components/editor/book-guide";
import { LoadingScreen } from "@/components/loading-screen";
import { findBook, setPref } from "@/lib/library-store";
import { useHydrated, usePrefs, useShelf } from "@/lib/use-library";

/**
 * A book with no chapter open.
 *
 * Opening a book used to jump straight into a chapter; now it lands here, on the
 * book's own overview. The chapter panel is on the left to choose where to
 * write, and the workspace shows a short guide rather than a chapter — there is
 * no manuscript to show until one is picked.
 */
export function BookOverview({ bookId }: { bookId: string }) {
  const hydrated = useHydrated();
  const shelf = useShelf();
  const prefs = usePrefs();
  const [tab, setTab] = useState<PanelTab>("chapters");

  // Nothing to render until storage has been read — see useHydrated.
  if (!hydrated) return <LoadingScreen />;

  const book = findBook(shelf, bookId);
  if (!book) return <MissingBook />;

  // The per-chapter panels (notes, bookmarks, the assistant) need a chapter to
  // act on even though none is on the page. The last one opened is the natural
  // anchor; a brand-new book has none, and those panels simply show empty.
  const anchor =
    book.chapters.find((c) => c.id === book.lastOpenedId) ??
    book.chapters[0] ??
    null;

  return (
    <div className="flex h-full">
      <WorkspaceRail
        bookId={bookId}
        tab={tab}
        onSelectTab={setTab}
        leftPanel={prefs.leftPanel}
        theme={prefs.theme}
      />

      {prefs.leftPanel && (
        <LeftPanel
          tab={tab}
          bookId={bookId}
          chapterId={anchor?.id ?? ""}
          chapterTitle={anchor?.title ?? ""}
          getChapterText={() => ""}
          onClose={() => setPref("leftPanel", false)}
        />
      )}

      <div className="flex min-w-0 flex-1 flex-col">
        <BookGuide title={book.title} />
      </div>
    </div>
  );
}

function MissingBook() {
  return (
    <main className="flex h-full items-center justify-center px-6">
      <div className="text-center">
        <p className="font-serif text-xl text-fg">This book isn’t here.</p>
        <p className="mt-2 font-sans text-sm text-muted">
          It may have been deleted, or the link may be wrong.
        </p>
        <Link
          href="/"
          className="mt-6 inline-block rounded-sm font-sans text-sm text-accent
                     underline underline-offset-4 outline-none
                     focus-visible:ring-2 focus-visible:ring-accent/60"
        >
          Back to your books
        </Link>
      </div>
    </main>
  );
}
