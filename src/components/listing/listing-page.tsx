"use client";

import { LoadingScreen } from "@/components/loading-screen";
import { ToolHeader } from "@/components/tool-header";
import { ListingDetails } from "@/components/export/publishing-card";
import { findBook } from "@/lib/library-store";
import { useHydrated, useShelf } from "@/lib/use-library";
import { toolShell, type ToolPageProps } from "@/lib/tool-page";

/**
 * The details a shop asks for, on a screen of their own.
 *
 * **They were only ever reachable through the export flow**, four steps in and
 * behind a format choice — so a writer who wanted to set an ISBN had to start
 * an export they did not want, pick EPUB because the listing steps exist for
 * EPUB alone, and walk to step five. The dashboard's own findings admitted as
 * much: "Set the ISBN" pointed at `export?step=listing`, a deep link invented
 * precisely because there was nowhere else to send anybody.
 *
 * These are facts about the book, not about an export. They are stored on the
 * book, they are asked for once, and every other thing a shop wants — the
 * blurb, the categories, the cover — already has a tool. This one was the
 * exception, and only because of where it happened to be built first.
 *
 * **The form itself is not copied.** `ListingDetails` is the same component the
 * export flow renders, so the two screens cannot drift into two answers about
 * what a shop asks for. This adds a door, not a second room.
 */
export function ListingPage({ bookId, embedded, heading }: ToolPageProps) {
  const hydrated = useHydrated();
  const shelf = useShelf();
  const book = findBook(shelf, bookId);

  // The app's splash is for the app; an embedded tool waits silently.
  if (!hydrated)
    return embedded ? <div className={toolShell(embedded)} /> : <LoadingScreen />;

  if (!book) {
    return (
      <div className="grid h-dvh place-items-center bg-surface p-8 text-center">
        <p className="text-lg font-bold text-fg">That book is not here.</p>
      </div>
    );
  }

  return (
    <div className={toolShell(embedded)}>
      {/* The trail keeps the trade words, the heading asks the writer's own
          question — the split comps, the title check, the blurb and the
          categories screens all make. */}
      {!embedded && (
        <ToolHeader
          book={book}
          tool="Listing details"
          title="What does a shop ask for?"
        >
          Every shop wants the same handful of facts before it will list a book
          — an ISBN, a language, a publisher, the date, the series it belongs
          to. Answer them once here and they travel with the book into every
          export.
        </ToolHeader>
      )}

      <div className="mx-auto max-w-3xl px-6 pt-6 pb-16">
        {heading}
        {/* `max-w-3xl`: this is a form rather than a grid of cards, and the
            5xl the tool pages default to would run a two-column layout of
            short fields across most of a laptop with nothing holding them
            together. */}
        <ListingDetails book={book} />

        {/* **Says that it saved, because nothing else does.**

            Inside the export flow these fields sat above a "Continue" button,
            which was the closure: you pressed it and moved on. On a screen of
            their own there is no next step, so a writer filled six boxes and
            got no acknowledgement of any kind — and the honest reading of a
            form that says nothing is that it did nothing.

            Placed under the fields rather than beside each one: the commit is
            per field and on blur, but the reassurance is about the screen. */}
        <p className="mt-5 text-xs text-muted">
          Saved as you go, and carried into every export. Nothing here is sent
          anywhere until you upload the file yourself.
        </p>
      </div>
    </div>
  );
}
