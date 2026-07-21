"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  BOOK_KINDS,
  DEFAULT_GENRE,
  DEFAULT_KIND,
  GENRES,
  suggestTarget,
  targetHint,
  type BookKind,
} from "@/lib/book-kinds";
import { createBook } from "@/lib/library-store";

/**
 * The step between "New book" and the blank page.
 *
 * It exists to put a goal on the book before the writing starts, because a
 * target set afterwards is a target set against work already done. Everything
 * here has a usable default, so the whole form can be cleared with Enter.
 *
 * A page rather than a modal: this is the start of the writing rather than an
 * interruption of something else, and it gets a URL of its own.
 */
export function NewBookForm() {
  const router = useRouter();

  const [title, setTitle] = useState("");
  const [kind, setKind] = useState<BookKind>(DEFAULT_KIND);
  const [genre, setGenre] = useState<string>(DEFAULT_GENRE);

  // The target follows the kind and genre until the writer types their own, at
  // which point it stops moving. Overwriting a number somebody deliberately
  // entered because they then changed the genre is the kind of thing that makes
  // a form feel like it is arguing with you.
  const [ownTarget, setOwnTarget] = useState<string | null>(null);
  const suggested = suggestTarget(kind, genre);
  const target = ownTarget ?? String(suggested);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();

    const words = Number.parseInt(target.replace(/[^0-9]/g, ""), 10);
    const { bookId, chapterId } = createBook(title.trim() || "Untitled Book", {
      kind,
      genre,
      // A cleared or nonsense field means no goal rather than a goal of zero.
      targetWords: Number.isFinite(words) && words > 0 ? words : undefined,
    });

    router.push(`/book/${bookId}/chapter/${chapterId}`);
  };

  return (
    <main className="min-h-dvh overflow-y-auto bg-surface px-4 py-12">
      <div className="mx-auto w-full max-w-[34rem]">
        <h1 className="text-center font-serif text-3xl text-fg">
          Create a new book
        </h1>
        <p className="mt-2 text-center font-sans text-sm text-muted">
          Set up your book so we can help you track progress.
        </p>

        <form onSubmit={submit} className="mt-9">
          <label className="block font-sans text-sm">
            <span className="font-medium text-fg">Book title</span>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Untitled Book"
              autoFocus
              className="mt-1.5 w-full rounded-md border border-line bg-panel
                         px-3 py-2.5 text-fg placeholder:text-muted
                         focus-visible:border-accent focus-visible:outline-none"
            />
          </label>

          <fieldset className="mt-6">
            <legend className="font-sans text-sm font-medium text-fg">
              What are you writing?
            </legend>
            <div
              role="radiogroup"
              aria-label="What are you writing?"
              className="mt-1.5 grid grid-cols-3 gap-2"
            >
              {BOOK_KINDS.map((option) => {
                const selected = option.value === kind;
                return (
                  <button
                    key={option.value}
                    type="button"
                    role="radio"
                    aria-checked={selected}
                    onClick={() => setKind(option.value)}
                    className={`rounded-md border px-2 py-3.5 text-center
                                outline-none transition-colors
                                focus-visible:ring-2
                                focus-visible:ring-accent/60 ${
                                  selected
                                    ? "border-accent bg-accent/10"
                                    : "border-line hover:border-accent/50 hover:bg-raised"
                                }`}
                  >
                    <span className="block font-sans text-sm font-medium text-fg">
                      {option.label}
                    </span>
                    <span className="mt-0.5 block font-sans text-xs text-muted">
                      {option.range}
                    </span>
                  </button>
                );
              })}
            </div>
          </fieldset>

          <label className="mt-6 block font-sans text-sm">
            <span className="font-medium text-fg">Genre</span>
            <select
              value={genre}
              onChange={(e) => setGenre(e.target.value)}
              className="mt-1.5 w-full rounded-md border border-line bg-panel
                         px-3 py-2.5 text-fg focus-visible:border-accent
                         focus-visible:outline-none"
            >
              {GENRES.map((g) => (
                <option key={g} value={g}>
                  {g}
                </option>
              ))}
            </select>
          </label>

          <label className="mt-6 block font-sans text-sm">
            <span className="font-medium text-fg">Target word count</span>
            <input
              value={target}
              onChange={(e) => setOwnTarget(e.target.value)}
              inputMode="numeric"
              className="mt-1.5 w-full rounded-md border border-line bg-panel
                         px-3 py-2.5 tabular-nums text-fg
                         focus-visible:border-accent focus-visible:outline-none"
            />
          </label>
          <p className="mt-1.5 font-sans text-xs text-muted">
            {ownTarget === null
              ? targetHint(kind, genre)
              : `Suggested for this is ${suggested.toLocaleString()}.`}
          </p>

          <div className="mt-9 flex items-center justify-end gap-2">
            <Link
              href="/"
              className="rounded-md px-3 py-2.5 font-sans text-sm text-muted
                         outline-none transition-colors hover:bg-raised
                         hover:text-fg focus-visible:ring-2
                         focus-visible:ring-accent/60"
            >
              Cancel
            </Link>
            <button
              type="submit"
              className="rounded-md bg-accent px-5 py-2.5 font-sans text-sm
                         font-semibold text-white outline-none
                         transition-colors hover:bg-accent-strong
                         focus-visible:ring-2 focus-visible:ring-accent/60"
            >
              Create book
            </button>
          </div>
        </form>
      </div>
    </main>
  );
}
