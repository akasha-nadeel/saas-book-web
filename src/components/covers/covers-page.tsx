"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { BookCover } from "@/components/shelf/book-cover";
import { LoadingScreen } from "@/components/loading-screen";
import { ToolHeader } from "@/components/tool-header";
import { buildQuery, coversOf, type CompTitle } from "@/lib/comps/comps";
import { checkCover, contrastOf, type CoverFacts } from "@/lib/cover-check";
import { bookWordCount, findBook } from "@/lib/library-store";
import { useCover, useHydrated, useShelf } from "@/lib/use-library";

/**
 * Covers, in the only two ways we can honestly help with one.
 *
 * Covers are the loudest sales pain in the research — a bad one sinks a good
 * book, and a good one costs a thousand pounds. We cannot design covers, and
 * the cheap way to would be generative, which this product has said in public
 * it will not do. So this module is the two things that are left, and they
 * divide cleanly:
 *
 * - **`CoversPage`, the wall.** The writer's cover beside twenty others in the
 *   same genre — what they would do themselves given a bookshop and an
 *   afternoon. The size control is the feature rather than a convenience:
 *   nobody buys a book at the size a cover is designed at, they see it sixty
 *   pixels wide next to nine others and decide in about a second, so the wall
 *   opens at thumbnail. A cover whose title cannot be read at 60px has a
 *   problem no amount of admiring it at full size will reveal.
 *
 * - **`CoverChecker`, the file.** Whether a shop will refuse it: dimensions,
 *   shape, weight, contrast. Mechanical, and that is the whole list.
 *
 * **Neither half scores anything.** No palette analysis, no "34% less saturated
 * than your genre" — partly because reading pixels off another origin's image
 * needs CORS headers neither catalogue reliably sends, and mostly because it
 * would be a number invented to look like an answer. The two things that
 * actually decide a cover — is the title readable small, does it look like its
 * genre — are answered by looking. Looking is the skill being lent.
 */

/**
 * The other half: whether the *file* will be refused.
 *
 * Checks the artwork the writer is about to upload, not the copy this app
 * stores — that one is compressed to fit a 250KB cap and would fail a size
 * check it was never meant to pass. Saying so matters: a checker quietly
 * measuring the wrong file is worse than none.
 *
 * Everything happens in the browser. The image is read into a canvas to measure
 * contrast and then discarded; nothing is uploaded, which is both the honest
 * default and the only one consistent with the rest of the page.
 */
function CoverChecker() {
  const [facts, setFacts] = useState<CoverFacts | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function read(file: File) {
    setError(null);
    const url = URL.createObjectURL(file);
    try {
      const image = new Image();
      await new Promise<void>((resolve, reject) => {
        image.onload = () => resolve();
        image.onerror = () => reject(new Error("not an image"));
        image.src = url;
      });

      // Contrast is measured on a small copy: a 2560px cover is six million
      // pixels and the answer does not change past a few thousand.
      let contrast: number | undefined;
      const canvas = document.createElement("canvas");
      canvas.width = 120;
      canvas.height = Math.max(
        1,
        Math.round((image.naturalHeight / image.naturalWidth) * 120),
      );
      const context = canvas.getContext("2d", { willReadFrequently: true });
      if (context) {
        context.drawImage(image, 0, 0, canvas.width, canvas.height);
        try {
          contrast = contrastOf(
            context.getImageData(0, 0, canvas.width, canvas.height).data,
            4,
          );
        } catch {
          // A tainted canvas cannot be read. Every other check still works, so
          // the contrast note is simply absent rather than the whole thing
          // failing.
        }
      }

      setFacts({
        width: image.naturalWidth,
        height: image.naturalHeight,
        bytes: file.size,
        ...(contrast !== undefined ? { contrast } : {}),
      });
      setPreview(url);
    } catch {
      URL.revokeObjectURL(url);
      setError("That file could not be read as an image.");
      setFacts(null);
      setPreview(null);
    }
  }

  const findings = facts ? checkCover(facts) : [];

  return (
    <section className="mt-12 border-t border-line pt-8">
      <h2 className="text-xl font-extrabold text-fg">Check the file</h2>
      <p className="mt-2 max-w-2xl text-muted">
        Drop in the artwork you are about to upload and this will say whether a
        shop refuses it. Check the real file, not the copy stored here — this
        app compresses covers to fit in your browser, so its version would fail
        a size check it was never meant to pass.
      </p>

      <input
        type="file"
        accept="image/*"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) void read(file);
        }}
        className="mt-4 text-sm text-fg"
      />

      {error && <p className="mt-4 text-sm text-fg">{error}</p>}

      {facts && (
        <div className="mt-6 flex flex-wrap gap-6">
          {preview && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={preview}
              alt=""
              className="h-[120px] w-[80px] shrink-0 rounded object-cover shadow-sm"
            />
          )}
          <div className="min-w-[16rem] flex-1">
            <p className="text-sm text-muted">
              {facts.width.toLocaleString()} × {facts.height.toLocaleString()}{" "}
              pixels · {(facts.bytes / 1024).toFixed(0)}KB ·{" "}
              {(facts.height / facts.width).toFixed(2)}:1
            </p>

            {findings.length === 0 ? (
              <p className="mt-3 rounded-lg border border-line bg-panel p-4 text-sm text-fg">
                Nothing a shop would refuse, and nothing worth flagging. That is
                the file checked — whether the cover works is the wall above.
              </p>
            ) : (
              <ul className="mt-3 flex flex-col gap-2">
                {findings.map((finding) => (
                  <li
                    key={finding.id}
                    className="rounded-lg border border-line bg-panel p-4"
                  >
                    <span className="flex flex-wrap items-center gap-2">
                      <span
                        className={`rounded-full px-2 py-0.5 text-[11px] font-bold uppercase ${
                          finding.level === "problem"
                            ? "bg-stop-bg text-stop-fg"
                            : "bg-raised text-muted"
                        }`}
                      >
                        {finding.level === "problem" ? "problem" : "note"}
                      </span>
                      <span className="font-bold text-fg">{finding.label}</span>
                    </span>
                    <p className="mt-1.5 text-sm text-muted">
                      {finding.detail}
                    </p>
                  </li>
                ))}
              </ul>
            )}

            <p className="mt-4 text-xs text-muted">
              Measured in your browser; the file is never uploaded. These are
              Amazon KDP&rsquo;s published figures and do not replace the
              shop&rsquo;s own check. Two things decide a cover and neither can
              be measured: whether the title is readable at 60px, and whether it
              looks like its genre. Both are up there on the wall.
            </p>
          </div>
        </div>
      )}
    </section>
  );
}

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
      <ToolHeader book={book} tool="Covers" width="5xl">
        Your cover, next to the shelf it has to sit on. We do not design covers
        and we will not generate one — this is the thing you would do yourself
        in a bookshop, if you had the afternoon.
      </ToolHeader>

      <div className="mx-auto max-w-5xl px-6 pt-6 pb-16">
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
            className="rounded-lg bg-accent px-5 py-2.5 font-semibold text-accent-ink disabled:opacity-50"
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
                      size === s.id ? "bg-accent text-accent-ink" : "text-muted"
                    }`}
                  >
                    {s.label}
                  </button>
                ))}
              </div>
              <p className="text-sm text-muted">
                {SIZES.find((s) => s.id === size)!.note} · {wall.length} covers
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

        <CoverChecker />

        <p className="mt-10 border-t border-line pt-6 text-xs text-muted">
          Covers are shown from Google Books and Open Library, at the size a
          reader meets them. The wall is not scored — a number comparing your
          cover to a genre would be invented to look like an answer. Look at the
          wall, then look at yours.
        </p>
      </div>
    </div>
  );
}
