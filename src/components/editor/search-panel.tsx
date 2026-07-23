"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { findBook } from "@/lib/library-store";
import { useShelf } from "@/lib/use-library";
import { searchChapters } from "@/lib/search";

/**
 * Find a word anywhere in the book.
 *
 * The shelf search matches titles; this reads every chapter's text, so a writer
 * can find the one place they named a character or dropped a thread. Debounced,
 * because searching re-reads and re-parses every chapter, and a result carries a
 * snippet so the sentence is visible before the chapter is opened.
 */
export function SearchPanel({ bookId }: { bookId: string }) {
  const router = useRouter();
  const book = findBook(useShelf(), bookId);
  const inputRef = useRef<HTMLInputElement>(null);

  const [query, setQuery] = useState("");
  const [debounced, setDebounced] = useState("");

  // Land in the field ready to type.
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  useEffect(() => {
    const id = setTimeout(() => setDebounced(query), 180);
    return () => clearTimeout(id);
  }, [query]);

  const hits = useMemo(
    () => (book ? searchChapters(book, debounced) : []),
    [book, debounced],
  );

  const trimmed = debounced.trim();

  return (
    <div className="flex h-full flex-col">
      <div className="shrink-0 border-b border-line p-3">
        <label className="relative block">
          <span className="sr-only">Search this book</span>
          <svg
            aria-hidden="true"
            viewBox="0 0 20 20"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.6"
            className="pointer-events-none absolute top-1/2 left-3 h-4 w-4
                       -translate-y-1/2 text-muted"
          >
            <circle cx="9" cy="9" r="6" />
            <path d="m13.5 13.5 3 3" strokeLinecap="round" />
          </svg>
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search in this book…"
            className="w-full rounded-md border border-line bg-surface py-2.5
                       pr-3 pl-9 font-sans text-sm text-fg placeholder:text-muted
                       focus-visible:border-accent focus-visible:outline-none"
          />
        </label>
      </div>

      {trimmed.length < 2 ? (
        <p className="p-4 font-sans text-sm text-muted">
          Type to search every chapter’s text.
        </p>
      ) : hits.length === 0 ? (
        <p className="p-4 font-sans text-sm text-muted">
          No matches for “{trimmed}”.
        </p>
      ) : (
        <ol className="scroll-slim flex min-h-0 flex-1 flex-col gap-0.5 overflow-y-auto p-2">
          {hits.map((hit) => (
            <li key={hit.chapterId}>
              <button
                type="button"
                onClick={() =>
                  router.push(`/book/${bookId}/chapter/${hit.chapterId}`)
                }
                className="block w-full rounded-md px-3 py-2.5 text-left outline-none
                           transition-colors hover:bg-raised focus-visible:ring-2
                           focus-visible:ring-accent/60"
              >
                <span className="flex items-baseline justify-between gap-2">
                  <span className="min-w-0 flex-1 truncate font-sans text-sm font-medium text-fg">
                    {hit.title}
                  </span>
                  <span className="shrink-0 font-sans text-xs tabular-nums text-muted">
                    {hit.count}
                  </span>
                </span>
                <span className="mt-1 block font-sans text-xs leading-relaxed text-muted">
                  {hit.before}
                  <mark className="rounded-sm bg-accent/25 px-0.5 text-fg">
                    {hit.match}
                  </mark>
                  {hit.after}
                </span>
              </button>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
