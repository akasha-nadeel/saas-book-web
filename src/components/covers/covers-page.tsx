"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { BookCover } from "@/components/shelf/book-cover";
import { LoadingScreen } from "@/components/loading-screen";
import { buildQuery, coversOf, type CompTitle } from "@/lib/comps/comps";
import { bookWordCount, findBook } from "@/lib/library-store";
import { useCover, useHydrated, useShelf } from "@/lib/use-library";

/**
 * The cover wall: a writer's cover beside the shelf it has to sit on.
 *
 * Covers are the loudest pain in the research — a bad one sinks a good book,
 * and a good one costs a thousand pounds. We cannot design covers, and the
 * cheap way to would be generative, which this product has said in public it
 * will not do. What is left is the thing a writer would do themselves if they
 * had a bookshop and an afternoon: stand your cover next to twenty others in
 * the same genre and see whether it belongs.
 *
 * **The size control is the feature, not a convenience.** Nobody buys a book at
 * the size a cover is designed at. They see it sixty pixels wide in a search
 * result, next to nine others, and decide in about a second — so the wall opens
 * at thumbnail size, which is the honest test, and the larger sizes are there
 * for looking at afterwards. A cover whose title cannot be read at 60px has a
 * problem that no amount of admiring it at full size will reveal.
 *
 * **Nothing here is scored.** No palette analysis, no "your cover is 34% less
 * saturated than your genre" — partly because reading pixels off another
 * origin's image needs CORS headers neither service reliably sends, and mostly
 * because it would be a number invented to look like an answer. The writer
 * looks. Looking is the skill being lent.
 */

/** Thumbnail first: it is the size the decision is actually made at. */
const SIZES = [
  { id: "thumb", label: "Thumbnail", width: 60, note: "as a shop shows it" },
  { id: "browse", label: "Browsing", width: 110, note: "as a shelf shows it" },
  { id: "large", label: "Large", width: 180, note: "as you designed it" },
] as const;

type SizeId = (typeof SIZES)[number]["id"];

export function CoversPage({ bookId }: { bookId: string }) {
  const hydrated = useHydrated();
  const shelf = useShelf();
  const book = findBook(shelf, bookId);
  const myCover = useCover(bookId);

  const [query, setQuery] = useState("");
  const [books, setBooks] = useState<CompTitle[]>([]);
  const [size, setSize] = useState<SizeId>("thumb");
  const [state, setState] = useState<"idle" | "loading" | "done" | "error">(
    "idle",
  );
  const [error, setError] = useState<string | null>(null);

  const seeded = useRef(false);
  useEffect(() => {
    if (!book || seeded.current) return;
    seeded.current = true;
    setQuery(
      buildQuery({ genre: book.genre, blurb: book.publishing?.description }),
    );
  }, [book]);

  const wall = useMemo(() => coversOf(books), [books]);
  const width = SIZES.find((s) => s.id === size)!.width;

  async function search(q: string) {
    if (q.trim().length < 2) return;
    setState("loading");
    setError(null);
    try {
      const response = await fetch(`/api/comps?q=${encodeURIComponent(q)}`);
      const data = await response.json();
      if (!response.ok) {
        setError(data?.error ?? "That search did not work.");
        setState("error");
        return;
      }
      setBooks(data.books ?? []);
      setState("done");
    } catch {
      setError("Could not reach the search. Check your connection.");
      setState("error");
    }
  }

  if (!hydrated) return <LoadingScreen />;

  if (!book) {
    return (
      <div className="grid h-dvh place-items-center bg-surface p-8 text-center">
        <div>
          <p className="text-lg font-bold text-fg">That book is not here.</p>
          <Link href="/" className="mt-3 inline-block text-accent">
            Back to your books
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="h-dvh overflow-y-auto bg-surface">
      <div className="mx-auto max-w-5xl px-6 py-10">
        <Link href={`/book/${bookId}`} className="text-sm text-muted">
          ← {book.title}
        </Link>
        <h1 className="mt-4 text-3xl font-extrabold text-fg">Covers</h1>
        <p className="mt-3 max-w-2xl text-muted">
          Your cover, next to the shelf it has to sit on. We do not design
          covers and we will not generate one — this is the thing you would do
          yourself in a bookshop, if you had the afternoon.
        </p>

        <form
          className="mt-6 flex flex-wrap gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            void search(query);
          }}
        >
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Words that describe your book"
            aria-label="Search for comparable books"
            className="min-w-[14rem] flex-1 rounded-lg border border-line bg-panel px-4 py-2.5
                       text-fg outline-none focus-visible:ring-2 focus-visible:ring-accent/50"
          />
          <button
            type="submit"
            disabled={state === "loading" || query.trim().length < 2}
            className="rounded-lg bg-accent px-5 py-2.5 font-semibold text-white disabled:opacity-50"
          >
            {state === "loading" ? "Looking…" : "Show me the shelf"}
          </button>
        </form>

        {error && (
          <p className="mt-6 rounded-lg border border-line bg-panel p-4 text-sm text-fg">
            {error}
          </p>
        )}

        {wall.length > 0 && (
          <>
            {/* The control that matters. Thumbnail is the default because it
                is where the decision is really made. */}
            <div className="mt-8 flex flex-wrap items-center gap-3">
              <div className="flex gap-1 rounded-lg border border-line bg-panel p-1">
                {SIZES.map((s) => (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => setSize(s.id)}
                    className={`rounded-md px-3.5 py-1.5 text-sm font-medium ${
                      size === s.id ? "bg-accent text-white" : "text-muted"
                    }`}
                  >
                    {s.label}
                  </button>
                ))}
              </div>
              <p className="text-sm text-muted">
                {SIZES.find((s) => s.id === size)!.note} ·{" "}
                {wall.length} covers
              </p>
            </div>

            <section className="mt-6 rounded-xl border border-line bg-panel p-5">
              <h2 className="text-sm font-bold text-fg">Yours</h2>
              <div className="mt-3" style={{ width }}>
                <BookCover
                  title={book.title}
                  subtitle={book.subtitle}
                  author={book.author}
                  words={bookWordCount(book)}
                  image={myCover ?? undefined}
                  bare={book.bareCover}
                  seed={book.id}
                />
              </div>
              {!myCover && (
                <p className="mt-3 text-xs text-muted">
                  No artwork on this book yet, so that is the generated one.
                  Compare it with the wall below and see what it is missing.
                </p>
              )}
            </section>

            <h2 className="mt-8 text-sm font-bold text-fg">The shelf</h2>
            <ul className="mt-3 flex flex-wrap gap-4">
              {wall.map((comp) => (
                <li key={comp.key} style={{ width }}>
                  {/* A plain img: two third-party hosts whose URLs we do not
                      control, and next/image would mean a config file listing
                      them that goes stale. */}
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={comp.coverUrl}
                    alt={`Cover of ${comp.title}`}
                    style={{ width }}
                    className="rounded shadow-sm"
                  />
                  {size !== "thumb" && (
                    <p className="mt-1.5 line-clamp-2 text-xs text-muted">
                      {comp.title}
                    </p>
                  )}
                </li>
              ))}
            </ul>
          </>
        )}

        {state === "done" && wall.length === 0 && (
          <p className="mt-8 text-muted">
            No covers came back for that search. Try describing the story rather
            than naming the genre.
          </p>
        )}

        <p className="mt-10 border-t border-line pt-6 text-xs text-muted">
          Covers are shown from Google Books and Open Library, at the size a
          reader meets them. Nothing here is scored or measured — a number
          comparing your cover to a genre would be invented to look like an
          answer. Look at the wall, then look at yours.
        </p>
      </div>
    </div>
  );
}
