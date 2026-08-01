"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { LoadingScreen } from "@/components/loading-screen";
import { ToolHeader } from "@/components/tool-header";
import { blurbReport } from "@/lib/blurb";
import { buildQuery, type CompTitle } from "@/lib/comps/comps";
import { findBook, setPublishing } from "@/lib/library-store";
import { BLURB_MAX } from "@/lib/publishing";
import { useHydrated, useShelf } from "@/lib/use-library";

/**
 * The blurb workshop.
 *
 * The blurb is the part writers say they are worst at, and what they reach for
 * is a chatbot — after which they report that the AI-written blurb hurt their
 * sales. So this writes nothing. It counts, and it shows what published books
 * in the same genre did.
 *
 * **Learning from examples rather than from advice** is the whole design. The
 * panel on the right is not a set of rules about blurbs; it is five real ones,
 * fetched from the comps search, with the length they run to. A writer can read
 * five blurbs from their own shelf in a minute and take more from that than
 * from any checklist we could write — and we are not qualified to write that
 * checklist anyway.
 *
 * Blurbs come from Google Books only. Open Library's search results carry none,
 * so when Google is rate-limited this half of the screen is empty and says so
 * rather than pretending the genre has no blurbs in it.
 */
export function BlurbPage({ bookId }: { bookId: string }) {
  const hydrated = useHydrated();
  const shelf = useShelf();
  const book = findBook(shelf, bookId);

  const [draft, setDraft] = useState("");
  const [examples, setExamples] = useState<CompTitle[]>([]);
  const [benchmark, setBenchmark] = useState<number | undefined>();
  const [state, setState] = useState<"idle" | "loading" | "done" | "error">(
    "idle",
  );
  const [googleDown, setGoogleDown] = useState(false);

  // Fill the box once, from what is stored. After that it is the writer's, and
  // rewriting it under them on a re-render would eat an edit.
  const seeded = useRef(false);
  useEffect(() => {
    if (!book || seeded.current) return;
    seeded.current = true;
    setDraft(book.publishing?.description ?? "");
  }, [book]);

  const report = useMemo(
    () => blurbReport(draft, { benchmark, title: book?.title }),
    [draft, benchmark, book?.title],
  );

  /**
   * What the examples are fetched with. Empty when the book has neither a genre
   * nor a blurb — which is most new books, and which used to be sent as `?q=`
   * and come back as "could not reach the search just now". It reached fine.
   * There was nothing to ask it.
   */
  const seedQuery = book
    ? buildQuery({ genre: book.genre, blurb: book.publishing?.description })
    : "";

  async function loadExamples() {
    if (!book || !seedQuery.trim()) return;
    setState("loading");
    try {
      const response = await fetch(
        `/api/comps?q=${encodeURIComponent(seedQuery)}`,
      );
      const data = await response.json();
      if (!response.ok) {
        setState("error");
        return;
      }
      const withBlurbs = (data.books as CompTitle[]).filter(
        (b) => b.description && b.description.length > 120,
      );
      setExamples(withBlurbs.slice(0, 5));
      setBenchmark(data.summary?.medianBlurbChars ?? undefined);
      setGoogleDown(data.sources?.google === false);
      setState("done");
    } catch {
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

  const over = report.stats.characters > BLURB_MAX;

  return (
    <div className="h-dvh overflow-y-auto bg-surface">
      <ToolHeader book={book} tool="Blurb" width="5xl">
        The two hundred words that decide whether anybody opens the book. We do
        not write it — we count it, and we show you what books like yours did.
      </ToolHeader>

      <div className="mx-auto max-w-5xl px-6 pt-6 pb-16">
        <div className="grid items-start gap-8 lg:grid-cols-[minmax(0,1fr)_320px]">
          {/* ---- The blurb itself -------------------------------------- */}
          <div>
            {/* The counters live inside the box's frame rather than under it.
                They were fourteen rows down, which on this screen meant below
                the fold — and a character count nobody can see while typing is
                a character count that does its job after the fact. */}
            <div className="overflow-hidden rounded-xl border border-line bg-panel focus-within:ring-2 focus-within:ring-accent/50">
              <textarea
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                // Saved on blur rather than on every keystroke: the shelf is one
                // document and a write per character is a write per character.
                onBlur={() => setPublishing(book.id, { description: draft })}
                rows={8}
                placeholder="What happens, who it happens to, and what is at stake."
                aria-label="Your blurb"
                className="w-full resize-y bg-transparent p-4 leading-relaxed text-fg
                           outline-none"
              />
              <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 border-t border-line bg-surface px-4 py-2 text-xs">
                <span
                  className={over ? "font-bold text-red-600" : "text-muted"}
                >
                  {report.stats.characters.toLocaleString()} /{" "}
                  {BLURB_MAX.toLocaleString()} characters · {report.stats.words}{" "}
                  words · {report.stats.paragraphs} paragraph
                  {report.stats.paragraphs === 1 ? "" : "s"}
                </span>
                <span className="text-muted">Saved when you click away</span>
              </div>
            </div>

            {/* What books like this one actually run to, once the examples
                have been fetched. A number on its own does not tell a writer
                whether four hundred characters is short; a mark on a line
                does. */}
            {benchmark !== undefined && report.stats.characters > 0 && (
              <div className="mt-3">
                <div className="relative h-1.5 rounded-full bg-raised">
                  <div
                    className="h-full rounded-full bg-accent"
                    style={{
                      width: `${Math.min(100, (report.stats.characters / (benchmark * 2)) * 100)}%`,
                    }}
                  />
                  {/* The median sits at the halfway mark, so the bar reads as
                      "about right in the middle" rather than as a target to
                      fill. There is no correct length and the scale should not
                      imply one. */}
                  <span
                    aria-hidden="true"
                    className="absolute top-1/2 h-3 w-0.5 -translate-y-1/2 rounded bg-fg/50"
                    style={{ left: "50%" }}
                  />
                </div>
                <p className="mt-1.5 text-xs text-muted">
                  Books like yours run about {benchmark.toLocaleString()}{" "}
                  characters, which is the mark in the middle. Yours is{" "}
                  {report.stats.characters.toLocaleString()}.
                </p>
              </div>
            )}

            {report.issues.length > 0 && (
              <ul className="mt-6 flex flex-col gap-2">
                {report.issues.map((issue) => (
                  <li
                    key={issue.field + issue.message}
                    className={`flex gap-3 rounded-lg border px-4 py-3 ${
                      issue.level === "problem"
                        ? "border-amber-500/40 bg-amber-500/8"
                        : "border-line bg-panel"
                    }`}
                  >
                    <span
                      aria-hidden="true"
                      className={`mt-0.5 text-sm font-bold ${
                        issue.level === "problem"
                          ? "text-amber-700"
                          : "text-muted"
                      }`}
                    >
                      {issue.level === "problem" ? "!" : "·"}
                    </span>
                    <span className="min-w-0">
                      <span className="text-sm font-bold text-fg">
                        {issue.field}
                      </span>
                      <span className="mt-0.5 block text-sm text-muted">
                        {issue.message}
                      </span>
                    </span>
                  </li>
                ))}
              </ul>
            )}

            {/* The one rule on this screen, said plainly so the notes above are
                not mistaken for rules too. */}
            <p className="mt-6 border-t border-line pt-4 text-xs text-muted">
              Only two things here are facts: an empty blurb, and one over{" "}
              {BLURB_MAX.toLocaleString()} characters, which shops refuse.
              Everything else is a measurement. Nobody knows whether your
              three-paragraph blurb beats a two-paragraph one, including us.
            </p>
          </div>

          {/* ---- Real blurbs ------------------------------------------- */}
          <aside>
            <h2 className="font-bold text-fg">Blurbs from books like yours</h2>
            <p className="mt-2 text-sm text-muted">
              Five real ones, so you can see the shape rather than be told it.
            </p>
            {!seedQuery.trim() ? (
              <p className="mt-4 rounded-lg border border-line bg-surface p-3 text-sm text-muted">
                Finding these needs something to search on, and this book has no
                genre or blurb set yet. Add a genre in{" "}
                <Link href="/" className="font-semibold text-accent">
                  Details
                </Link>{" "}
                on the shelf, or write a first draft of the blurb here — either
                gives it enough to go on.
              </p>
            ) : (
              <button
                type="button"
                onClick={loadExamples}
                disabled={state === "loading"}
                // Filled. It is the only action in this column and it was a
                // white box on a white panel, which reads as disabled.
                className="mt-4 w-full rounded-lg bg-accent px-4 py-2.5 text-sm
                         font-semibold text-white disabled:opacity-50"
              >
                {state === "loading" ? "Looking…" : "Show me five"}
              </button>
            )}

            {benchmark && (
              <p className="mt-4 rounded-lg border border-line bg-panel p-3 text-sm text-fg">
                Books like yours run to about{" "}
                <strong>{benchmark.toLocaleString()}</strong> characters.
              </p>
            )}

            {googleDown && (
              <p className="mt-4 rounded-lg border border-line bg-panel p-3 text-xs text-muted">
                Google Books did not answer, and it is the only one of the two
                that carries blurbs — so there are none to show. It rate-limits
                without an API key.
              </p>
            )}

            {state === "error" && (
              <p className="mt-4 rounded-lg border border-amber-500/40 bg-amber-500/8 p-3 text-sm text-fg">
                That search did not come back. Google Books rate-limits without
                an API key, which is the usual reason — see{" "}
                <code className="text-xs">.env.local.example</code>. Your blurb
                is untouched either way.
              </p>
            )}

            {state === "done" && examples.length === 0 && !googleDown && (
              <p className="mt-4 text-sm text-muted">
                No blurbs came back for this genre. Try the comps page and edit
                the search.
              </p>
            )}

            <ul className="mt-4 flex flex-col gap-3">
              {examples.map((example) => (
                <li
                  key={example.key}
                  className="rounded-xl border border-line bg-panel p-4"
                >
                  <p className="text-sm font-bold text-fg">{example.title}</p>
                  <p className="text-xs text-muted">
                    {example.authors[0]}
                    {example.description
                      ? ` · ${example.description.length} characters`
                      : ""}
                  </p>
                  <p className="mt-2 text-sm leading-relaxed text-muted">
                    {example.description}
                  </p>
                </li>
              ))}
            </ul>
          </aside>
        </div>
      </div>
    </div>
  );
}
