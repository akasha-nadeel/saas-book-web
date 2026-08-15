"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  BookPanel,
  useOpenPart,
  type BookPanelMode,
} from "@/components/editor/book-panel";
import { BookGuide } from "@/components/editor/book-guide";
import { LoadingScreen } from "@/components/loading-screen";
import { findBook, setPref, touchLastOpenedBook } from "@/lib/library-store";
import { useCover, useHydrated, usePrefs, useShelf } from "@/lib/use-library";

/**
 * A book with no chapter open.
 *
 * Opening a book lands here rather than jumping into a chapter: the book panel
 * — three cards for the parts of the book, with the chapter list inside the
 * middle one — and a short guide where the page would be, because there is no
 * page until a chapter is picked.
 *
 * **No workspace rail here, and no tool panel.** It carried both, on the
 * reasoning that this is the editor with the manuscript taken out. But every
 * one of those nine tabs is a thing you keep *beside a page you are writing* —
 * search, notes, the story bible, versions — and on a screen with no page they
 * were nine ways to open a panel about a chapter chosen for the writer rather
 * than by them. What this screen actually needs at its top left is the way
 * back out, which the rail was burying among them. So the rail belongs to the
 * editor, and this has one button.
 *
 * It used to carry its own chapter list on the left, from before the book panel
 * existed. Two navigators for one book meant two things to keep in step and two
 * different answers to "where are my chapters", so the older one is gone and
 * this screen and the editor navigate the same way.
 */
export function BookOverview({ bookId }: { bookId: string }) {
  const hydrated = useHydrated();
  const shelf = useShelf();
  const prefs = usePrefs();
  const cover = useCover(bookId);
  const body = useOpenPart();

  // Plays the panel's entrance, and only when the face changes — the same rule
  // the editor follows, so the two screens behave alike. Cleared once the
  // longest of the animations has finished.
  const [entering, setEntering] = useState(false);
  useEffect(() => {
    if (!entering) return;
    const done = setTimeout(() => setEntering(false), 1100);
    return () => clearTimeout(done);
  }, [entering]);

  // Opening a book is opening it, whether or not a chapter is picked next.
  // Without this the shelf only learns of the visit if the writer goes on into
  // a chapter, so a book opened to look at its cover would never rise to the
  // top of "Continue writing".
  useEffect(() => {
    if (hydrated) touchLastOpenedBook(bookId);
  }, [hydrated, bookId]);

  // The overview always opens on the book itself.
  //
  // The panel's face is a stored preference so the *editor* keeps whichever one
  // the writer left it on across a reload — that is what the pref is for. But
  // arriving here is arriving at the book, and this screen is the one place the
  // whole book is the subject. Coming back from a chapter should show the book
  // again, not the parts list that chapter happened to leave behind.
  //
  // Written rather than merely overridden in the render, so switching faces from
  // here still persists into the editor; it is the *arrival* that is fixed, not
  // the choice.
  useEffect(() => {
    if (hydrated) setPref("bookPanel", "book");
    // Once per book opened. Deliberately not watching prefs.bookPanel — that
    // would snap the panel back the instant the writer pressed Chapters.
  }, [hydrated, bookId]);

  // Nothing to render until storage has been read — see useHydrated.
  if (!hydrated) return <LoadingScreen />;

  const book = findBook(shelf, bookId);
  if (!book) return <MissingBook />;

  return (
    <div className="flex h-full">
      {/* The way out, in the corner the rail used to fill.
​
          One button rather than a strip of them: from a book, "back" has a
          single meaning — the shelf you came from. It keeps the rail's own
          width and top inset so the panel beside it starts where it always
          did, and it is a link rather than `router.back()`, which would send
          somebody who arrived from a chapter into the chapter again. */}
      <div className="shrink-0 px-2 pt-3">
        <Link
          href="/"
          aria-label="All books"
          title="All books"
          className="flex h-12 w-12 items-center justify-center rounded-xl
                     text-muted outline-none transition-colors hover:bg-raised
                     hover:text-fg focus-visible:ring-2 focus-visible:ring-accent/60"
        >
          <svg
            aria-hidden="true"
            viewBox="0 0 20 20"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="h-5 w-5"
          >
            <path d="M12 5l-5 5 5 5" />
          </svg>
        </Link>
      </div>

      {/* Left of the guide, exactly where it sits beside the manuscript in the
          editor. This screen is that one with the page taken out, so the panel
          cannot swap sides on the way — a writer opening a book and then a
          chapter would watch the whole book move across the window.

          No chapter is open, so nothing is selected and no microphone is
          offered: there is no manuscript here to dictate into. */}
      <BookPanel
        book={book}
        chapterId={null}
        cover={cover}
        paper={prefs.paper}
        mode={prefs.bookPanel}
        onMode={(mode: BookPanelMode) => {
          setEntering(true);
          setPref("bookPanel", mode);
        }}
        entering={entering}
        body={body}
        always
      />

      {/* **The resume card is gone and the panel's own button does its job.**
          It sat here above the guide, and beside it — a hand's width to the
          left — the book card's button offered the same move under a different
          name. Two controls for one intention on one screen, and the wrong one
          looked like the way in. The button now carries on where the writer
          left off and says which chapter that is; see `openBook`. */}
      <div className="flex min-w-0 flex-1 flex-col overflow-y-auto">
        <BookGuide title={book.title} book={book} entering={entering} />
      </div>
    </div>
  );
}

function MissingBook() {
  return (
    <main className="flex h-full items-center justify-center px-6">
      <div className="text-center">
        <p className="font-serif text-xl text-fg">This book isn’t here.</p>
        <p className="mt-2 font-sans text-sm text-muted">
          It may have been deleted, or the link may be wrong.
        </p>
        <Link
          href="/"
          className="mt-6 inline-block rounded-sm font-sans text-sm text-accent
                     underline underline-offset-4 outline-none
                     focus-visible:ring-2 focus-visible:ring-accent/60"
        >
          Back to your books
        </Link>
      </div>
    </main>
  );
}
