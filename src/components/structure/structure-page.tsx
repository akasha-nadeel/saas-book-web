"use client";

import Link from "next/link";
import { GENRE_NOTES, placeBeats, whereYouAre } from "@/lib/beats";
import { suggestTarget } from "@/lib/book-kinds";
import { bookWordCount, findBook, setTargetWords } from "@/lib/library-store";
import { LoadingScreen } from "@/components/loading-screen";
import { ToolHeader } from "@/components/tool-header";
import { useHydrated, useShelf } from "@/lib/use-library";

/**
 * Where you are in the shape, and what usually happens there.
 *
 * For the writer at 30,000 words of an 80,000-word book who has run out of
 * road — the most-repeated craft complaint in the research, and always at the
 * same place. They do not need a theory of narrative. They need somebody to
 * say: you are at the middle, and the middle is where the thing that makes
 * going back impossible usually happens.
 *
 * **It refuses to work without a target**, and offers to set one rather than
 * guessing. Every position here is a share of a finished length; inventing that
 * length from the genre would put a number on screen the writer never agreed
 * to, and then measure them against it.
 *
 * **The page says twice that this is a convention rather than a rule**, at the
 * top and at the foot, because a structure tool is one bad sentence away from
 * being the writing course this product exists in opposition to.
 */
export function StructurePage({ bookId }: { bookId: string }) {
  const hydrated = useHydrated();
  const shelf = useShelf();
  const book = findBook(shelf, bookId);

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

  const words = bookWordCount(book);
  const placements = placeBeats(words, book.targetWords);
  const line = whereYouAre(placements, words);
  const note = book.genre ? GENRE_NOTES[book.genre] : undefined;
  const suggested = suggestTarget(book.kind ?? "novel", book.genre ?? "Other");

  return (
    <div className="h-dvh overflow-y-auto bg-surface">
      <ToolHeader book={book} tool="Structure">
        The shape most novels share, in plain words, with your word count on it.
        A convention, not a rule — good novels break every line below.
      </ToolHeader>

      <div className="mx-auto max-w-3xl px-6 pt-6 pb-16">
        {!placements ? (
          <section className="mt-8 rounded-xl border border-line bg-panel p-5">
            <p className="font-bold text-fg">This book has no target length</p>
            <p className="mt-2 text-muted">
              Every position here is a share of a finished book, so there is
              nothing to take a share of yet. We will not guess one from your
              genre — that would put a number on screen you never agreed to and
              then measure you against it.
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => setTargetWords(book.id, suggested)}
                className="rounded-lg bg-accent px-5 py-2.5 text-sm font-semibold text-white"
              >
                Use {suggested.toLocaleString()} words
              </button>
              <Link
                href={`/book/${bookId}/comps`}
                className="rounded-lg border border-line px-5 py-2.5 text-sm font-semibold text-fg"
              >
                Get one from real books
              </Link>
            </div>
            <p className="mt-3 text-xs text-muted">
              {suggested.toLocaleString()} is the figure everybody repeats for
              this genre. The comps page works one out from books that exist.
            </p>
          </section>
        ) : (
          <>
            <p className="mt-8 rounded-xl border border-line bg-panel px-5 py-4 text-fg">
              {line}
            </p>

            {note && (
              <section className="mt-4 rounded-xl border border-line bg-panel px-5 py-4">
                <p className="text-sm font-bold text-fg">
                  What differs in {book.genre?.toLowerCase()}
                </p>
                <p className="mt-1.5 text-sm text-muted">{note}</p>
              </section>
            )}

            <ol className="mt-8 flex flex-col gap-3">
              {placements.map((beat) => (
                <li
                  key={beat.id}
                  className={`rounded-xl border p-5 ${
                    beat.current
                      ? "border-accent bg-accent/[0.06]"
                      : "border-line bg-panel"
                  } ${beat.passed ? "opacity-70" : ""}`}
                >
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <p className="font-bold text-fg">
                      {beat.title}
                      {beat.current && (
                        <span className="ml-2 rounded-full bg-accent px-2 py-0.5 text-[11px] font-bold uppercase text-white">
                          you are here
                        </span>
                      )}
                    </p>
                    <p className="text-xs text-muted">
                      {beat.fromWords.toLocaleString()}–
                      {beat.toWords.toLocaleString()} words
                    </p>
                  </div>
                  <p className="mt-2 text-sm leading-relaxed text-muted">
                    {beat.what.replace(/\*\*/g, "")}
                  </p>
                </li>
              ))}
            </ol>
          </>
        )}

        <p className="mt-10 border-t border-line pt-6 text-xs text-muted">
          These names are ours and deliberately plain. The famous beat sheets
          are somebody&rsquo;s copyrighted framework, and their vocabulary is a
          barrier of its own — you should not have to read a book about
          structure before you can use a page about structure. Nothing here is a
          rule, and no part of your book is wrong for being somewhere else.
        </p>
      </div>
    </div>
  );
}
