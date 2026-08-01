"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { LoadingScreen } from "@/components/loading-screen";
import { ToolHeader } from "@/components/tool-header";
import type { CompTitle } from "@/lib/comps/comps";
import { findClashes, type TitleClash } from "@/lib/comps/title-check";
import { findBook } from "@/lib/library-store";
import { useHydrated, useShelf } from "@/lib/use-library";

/**
 * Whether anything is already published under this title.
 *
 * **The answer is never yes or no, and the page says so.** Book titles are not
 * trademarks and cannot be copyrighted, so nothing here is about permission.
 * What a writer actually wants to know is whether they are publishing into a
 * shadow — whether searching their title brings back somebody else's book
 * first, and whether that book is big enough that theirs will never be found.
 *
 * So it shows what is out there and grades how close each one is. It does not
 * advise, because the same fact means different things: sharing a title with an
 * obscure book from 1974 is nothing, and sharing one with a bestseller in the
 * same genre is a real problem, and the writer can tell which of those they are
 * looking at faster than any rule we could write.
 */
export function TitleCheckPage({ bookId }: { bookId: string }) {
  const hydrated = useHydrated();
  const shelf = useShelf();
  const book = findBook(shelf, bookId);

  const [title, setTitle] = useState("");
  const [clashes, setClashes] = useState<TitleClash[] | null>(null);
  const [state, setState] = useState<"idle" | "loading" | "done" | "error">(
    "idle",
  );
  const [error, setError] = useState<string | null>(null);

  const seeded = useRef(false);
  useEffect(() => {
    if (!book || seeded.current) return;
    seeded.current = true;
    setTitle(book.title);
  }, [book]);

  async function check(candidate: string) {
    if (candidate.trim().length < 2) return;
    setState("loading");
    setError(null);
    try {
      // Searched as the title itself, unlike every other screen here — the
      // comps query deliberately leaves the writer's title out, because comps
      // are books *like* yours. This is the one question where finding a book
      // with the same name is the whole point.
      const response = await fetch(
        `/api/comps?q=${encodeURIComponent(`intitle:"${candidate.trim()}"`)}`,
      );
      const data = await response.json();
      if (!response.ok) {
        setError(data?.error ?? "That search did not work.");
        setState("error");
        return;
      }
      setClashes(findClashes(candidate, (data.books ?? []) as CompTitle[]));
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

  const exact = clashes?.filter((c) => c.match === "exact") ?? [];

  return (
    <div className="h-dvh overflow-y-auto bg-surface">
      <ToolHeader book={book} tool="Title check" title="Is this title taken?">
        Strictly, no title is taken — titles are not trademarks and cannot be
        copyrighted. The useful question is whether somebody else&rsquo;s book
        turns up first when a reader searches for yours.
      </ToolHeader>

      <div className="mx-auto max-w-3xl px-6 pt-6 pb-16">
        <form
          className="mt-6 flex flex-wrap gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            void check(title);
          }}
        >
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="A title you are considering"
            aria-label="Title to check"
            className="min-w-[14rem] flex-1 rounded-lg border border-line bg-panel px-4 py-2.5
                       text-fg outline-none focus-visible:ring-2 focus-visible:ring-accent/50"
          />
          <button
            type="submit"
            disabled={state === "loading" || title.trim().length < 2}
            className="rounded-lg bg-accent px-5 py-2.5 font-semibold text-white disabled:opacity-50"
          >
            {state === "loading" ? "Looking…" : "Check it"}
          </button>
        </form>
        <p className="mt-2 text-xs text-muted">
          Try any title, not just this book&rsquo;s — nothing here is saved.
        </p>

        {error && (
          <p className="mt-6 rounded-lg border border-line bg-panel p-4 text-sm text-fg">
            {error}
          </p>
        )}

        {state === "done" && clashes && clashes.length === 0 && (
          <p className="mt-8 rounded-lg border border-line bg-panel p-4 text-fg">
            Nothing came back under that name. That is not proof it is
            unpublished — these two catalogues are large and not complete — but
            it is a good sign.
          </p>
        )}

        {clashes && clashes.length > 0 && (
          <>
            <p className="mt-8 text-fg">
              {exact.length > 0
                ? `${exact.length} book${
                    exact.length === 1 ? "" : "s"
                  } published under that exact name, and ${
                    clashes.length - exact.length
                  } close to it.`
                : `Nothing under that exact name, but ${clashes.length} close to it.`}
            </p>

            <ul className="mt-4 flex flex-col gap-3">
              {clashes.map(({ book: other, match }) => (
                <li
                  key={other.key}
                  className="flex gap-4 rounded-xl border border-line bg-panel p-4"
                >
                  {other.coverUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={other.coverUrl}
                      alt=""
                      className="h-[72px] w-[48px] shrink-0 rounded object-cover"
                    />
                  ) : (
                    <div className="h-[72px] w-[48px] shrink-0 rounded bg-raised" />
                  )}
                  <div className="min-w-0 flex-1">
                    <span className="flex flex-wrap items-center gap-2">
                      <span
                        className={`rounded-full px-2 py-0.5 text-[11px] font-bold uppercase ${
                          match === "exact"
                            ? "bg-amber-100 text-amber-800"
                            : "bg-raised text-muted"
                        }`}
                      >
                        {match === "exact"
                          ? "same name"
                          : match === "close"
                            ? "near"
                            : "contains yours"}
                      </span>
                      <span className="font-bold text-fg">{other.title}</span>
                    </span>
                    <p className="mt-1 text-sm text-muted">
                      {other.authors.join(", ")}
                      {other.year ? ` · ${other.year}` : ""}
                    </p>
                    {other.infoUrl && (
                      <a
                        href={other.infoUrl}
                        target="_blank"
                        rel="noreferrer noopener"
                        className="mt-1.5 inline-block text-xs text-accent"
                      >
                        Look at it yourself →
                      </a>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          </>
        )}

        <p className="mt-10 border-t border-line pt-6 text-xs text-muted">
          We do not tell you whether to change it. Sharing a title with an
          obscure book from 1974 is nothing; sharing one with a bestseller in
          your own genre is a real problem, and you can tell which of those you
          are looking at faster than any rule we could write.
        </p>
      </div>
    </div>
  );
}
