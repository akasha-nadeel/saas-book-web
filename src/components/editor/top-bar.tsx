"use client";

import {
  renameBook,
  setPref,
  type Book,
  type PaperColor,
} from "@/lib/library-store";

/** Swatch previews. The real colours live in globals.css keyed by data-paper;
 *  these only have to look like them at 16px. */
const PAPERS: { value: PaperColor; label: string; swatch: string }[] = [
  { value: "white", label: "White", swatch: "#ffffff" },
  { value: "cream", label: "Cream", swatch: "#f5f1e8" },
  { value: "sepia", label: "Sepia", swatch: "#f2e7d0" },
  { value: "slate", label: "Slate", swatch: "#1d2732" },
  { value: "black", label: "Black", swatch: "#0a0d11" },
];

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
          className={`h-4 w-4 rounded-full border-2 outline-none
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
 * The centre column's own header.
 *
 * This used to span the whole window above the rails, which pushed both them
 * and the manuscript panel down and broke the full-height columns the reference
 * has. It belongs to the column it titles, so the rails now run floor to
 * ceiling and the panel starts at the top of the window.
 */
export function ColumnHeader({
  book,
  paper,
}: {
  book: Book;
  paper: PaperColor;
}) {
  return (
    <header className="flex h-14 shrink-0 items-center gap-4 px-6">
      <input
        value={book.title}
        onChange={(e) => renameBook(book.id, e.target.value)}
        onBlur={(e) => {
          if (!e.target.value.trim()) renameBook(book.id, "Untitled Book");
        }}
        aria-label="Book title"
        spellCheck={false}
        className="min-w-0 flex-1 truncate rounded-sm bg-transparent font-sans
                   text-lg text-fg outline-none focus-visible:ring-2
                   focus-visible:ring-accent/60"
      />
      <PaperSwatches paper={paper} />
    </header>
  );
}
