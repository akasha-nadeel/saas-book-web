"use client";

import Link from "next/link";
import { renameBook, setPref, type Book, type Prefs } from "@/lib/library-store";

/**
 * Breadcrumb, panel toggles, and export — the strip above everything.
 *
 * The book title is editable in place here rather than in the sidebar, since
 * this is where the reference design puts it and it is the one spot visible
 * from every chapter.
 */

function PanelToggle({
  on,
  onToggle,
  label,
  side,
}: {
  on: boolean;
  onToggle: () => void;
  label: string;
  side: "left" | "right";
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-pressed={on}
      aria-label={label}
      title={label}
      className={`flex h-8 w-8 items-center justify-center rounded-md
                  outline-none transition-colors focus-visible:ring-2
                  focus-visible:ring-accent/60 ${
                    on
                      ? "bg-accent/15 text-accent"
                      : "text-muted hover:bg-raised hover:text-fg"
                  }`}
    >
      <svg
        aria-hidden="true"
        viewBox="0 0 20 20"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        className="h-4 w-4"
      >
        <rect x="2.5" y="3.5" width="15" height="13" rx="2" />
        {side === "left" ? (
          <path d="M8 3.5v13" />
        ) : (
          <path d="M12 3.5v13" />
        )}
      </svg>
    </button>
  );
}

export function TopBar({
  book,
  chapterTitle,
  prefs,
  onExport,
}: {
  book: Book;
  chapterTitle: string;
  prefs: Prefs;
  onExport: () => void;
}) {
  return (
    <header
      className="flex h-12 shrink-0 items-center gap-2 border-b border-line
                 bg-panel px-3"
    >
      <PanelToggle
        side="left"
        on={prefs.leftPanel}
        label="Toggle chapters and notes"
        onToggle={() => setPref("leftPanel", !prefs.leftPanel)}
      />

      <nav
        aria-label="Breadcrumb"
        className="flex min-w-0 flex-1 items-baseline gap-2 font-sans text-sm"
      >
        <Link
          href="/"
          className="shrink-0 rounded-sm text-muted outline-none
                     hover:text-accent focus-visible:ring-2
                     focus-visible:ring-accent/60"
        >
          All books
        </Link>
        <span aria-hidden="true" className="shrink-0 text-muted/60">
          /
        </span>
        <input
          value={book.title}
          onChange={(e) => renameBook(book.id, e.target.value)}
          onBlur={(e) => {
            if (!e.target.value.trim()) renameBook(book.id, "Untitled Book");
          }}
          aria-label="Book title"
          spellCheck={false}
          className="w-40 shrink-0 truncate rounded-sm bg-transparent text-muted
                     outline-none hover:text-fg focus-visible:ring-2
                     focus-visible:ring-accent/60"
        />
        <span aria-hidden="true" className="shrink-0 text-muted/60">
          /
        </span>
        <span className="truncate font-medium text-fg">{chapterTitle}</span>
      </nav>

      <button
        type="button"
        onClick={onExport}
        className="shrink-0 rounded-md px-2.5 py-1.5 font-sans text-xs
                   tracking-wide text-muted uppercase outline-none
                   transition-colors hover:bg-raised hover:text-fg
                   focus-visible:ring-2 focus-visible:ring-accent/60"
      >
        Export
      </button>

      <PanelToggle
        side="right"
        on={prefs.rightPanel}
        label="Toggle assistant"
        onToggle={() => setPref("rightPanel", !prefs.rightPanel)}
      />
    </header>
  );
}
