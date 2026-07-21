"use client";

import { useState } from "react";
import { ChapterSidebar } from "@/components/sidebar/chapter-sidebar";
import { BookmarksPanel } from "@/components/editor/bookmarks-panel";
import { NotesPanel } from "@/components/editor/notes-panel";

/**
 * Chapters, notes and bookmarks, tabbed.
 *
 * The reference design puts notes here and moves navigation into a dropdown.
 * Navigation has to live somewhere permanent in an app whose whole shape is a
 * list of chapters, so they share the panel instead.
 */

type Tab = "chapters" | "notes" | "bookmarks";

export function LeftPanel({
  bookId,
  chapterId,
}: {
  bookId: string;
  chapterId: string;
}) {
  const [tab, setTab] = useState<Tab>("chapters");

  return (
    <aside
      className="flex w-(--sidebar-width) shrink-0 flex-col border-r
                 border-line bg-panel"
      aria-label="Chapters, notes and bookmarks"
    >
      <div role="tablist" className="flex shrink-0 border-b border-line">
        {(["chapters", "notes", "bookmarks"] as const).map((value) => (
          <button
            key={value}
            role="tab"
            aria-selected={tab === value}
            onClick={() => setTab(value)}
            // White on the active tab, with the accent kept to the underline —
            // green text on a dark panel was the least legible part of this.
            className={`flex-1 border-b-2 px-1 py-2.5 font-sans text-[0.65rem]
                        tracking-wide uppercase outline-none transition-colors
                        focus-visible:ring-2 focus-visible:ring-accent/60 ${
                          tab === value
                            ? "border-accent text-fg"
                            : "border-transparent text-muted hover:text-fg"
                        }`}
          >
            {value}
          </button>
        ))}
      </div>

      {/* No scroll of its own: each tab owns its scrolling, so the chapter list
          can scroll under a pinned button while notes scroll whole. */}
      <div className="min-h-0 flex-1">
        {tab === "chapters" && <ChapterSidebar bookId={bookId} />}
        {tab === "notes" && <NotesPanel key={chapterId} chapterId={chapterId} />}
        {tab === "bookmarks" && <BookmarksPanel bookId={bookId} />}
      </div>
    </aside>
  );
}
