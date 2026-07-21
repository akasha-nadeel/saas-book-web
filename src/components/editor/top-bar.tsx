"use client";

import Link from "next/link";
import {
  renameBook,
  setPref,
  type Book,
  type PaperColor,
  type Prefs,
} from "@/lib/library-store";

/** Swatch previews. The real colours live in globals.css keyed by data-paper;
 *  these only have to look like them at 20px. */
const PAPERS: { value: PaperColor; label: string; swatch: string }[] = [
  { value: "white", label: "White", swatch: "#ffffff" },
  { value: "cream", label: "Cream", swatch: "#f5f1e8" },
  { value: "sepia", label: "Sepia", swatch: "#f2e7d0" },
  { value: "slate", label: "Slate", swatch: "#1d2732" },
  { value: "black", label: "Black", swatch: "#0a0d11" },
];

/**
 * Page colour, out in the open.
 *
 * It was a section inside the page-setup menu, which made changing it two
 * clicks and a scroll. It is the one page setting a writer flips on a whim —
 * because the light is different, or their eyes are tired — so it sits in the
 * bar where a single click reaches it.
 */
function PaperSwatches({ paper }: { paper: PaperColor }) {
  return (
    <div
      role="radiogroup"
      aria-label="Page colour"
      className="flex shrink-0 items-center gap-1.5"
    >
      {PAPERS.map((p) => (
        <button
          key={p.value}
          type="button"
          role="radio"
          aria-checked={p.value === paper}
          aria-label={p.label}
          title={`Page colour: ${p.label}`}
          onClick={() => setPref("paper", p.value)}
          className={`h-5 w-5 rounded-full border-2 outline-none
                      transition-colors focus-visible:ring-2
                      focus-visible:ring-accent/60 ${
                        p.value === paper
                          ? "border-accent"
                          : "border-line hover:border-muted"
                      }`}
          style={{ background: p.swatch }}
        />
      ))}
    </div>
  );
}

/**
 * Breadcrumb, panel toggles, and export — the strip above everything.
 *
 * The book title is editable in place here rather than in the sidebar, since
 * this is where the reference design puts it and it is the one spot visible
 * from every chapter.
 */

export function TopBar({
  book,
  chapterTitle,
  prefs,
}: {
  book: Book;
  chapterTitle: string;
  prefs: Prefs;
}) {
  return (
    <header
      className="flex h-12 shrink-0 items-center gap-2 border-b border-line
                 bg-panel px-3"
    >
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

      {/* Panel toggles and Export live in the rails now; what is left here is
          where you are, and what the page looks like. */}
      <PaperSwatches paper={prefs.paper} />
    </header>
  );
}
