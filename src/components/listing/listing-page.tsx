"use client";

import { useState } from "react";
import { LoadingScreen } from "@/components/loading-screen";
import { ToolHeader } from "@/components/tool-header";
import { ListingDetails } from "@/components/export/publishing-card";
import { ToolSaveBar } from "@/components/ui/tool-save";
import { findBook, setPublishing } from "@/lib/library-store";
import { tidyPublishing, type PublishingMeta } from "@/lib/publishing";
import { useHydrated, useShelf } from "@/lib/use-library";
import { useToolSave } from "@/lib/use-tool-save";
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

  /*
   * Held on screen until Save, rather than written field by field on blur.
   *
   * Inside the export wizard those blur-commits are fine: the fields sit above
   * a Continue button, which is the closure. Here there is no next step, so
   * the screen used to end on a sentence promising it had saved and nothing
   * else — and a form that only *claims* to have worked is the thing a writer
   * checks by leaving and coming back.
   *
   * Two of the road's steps read straight off these fields ("Sort out an
   * ISBN", "Decide the name on the cover"), and both are detected rather than
   * stored, so pressing Save is what ticks them.
   */
  const stored = book?.publishing;
  /* `null` while the store has not been read, which an empty object cannot
     say — and saying it with a `seeded` ref meant reading that ref during
     render to work out whether the form had been touched. */
  const [draft, setDraft] = useState<PublishingMeta | null>(null);
  /* Untouched, so the form shows the book. No effect copies it in — that
     would be a second render for something the first one already knew. */
  const fields = draft ?? stored ?? {};

  const save = useToolSave({
    book,
    tool: "listing",
    /* Through `tidyPublishing` rather than a plain stringify: a box the writer
       cleared is `""` here and *absent* once stored, so the raw comparison
       would leave the form permanently unsaved. See that function. */
    dirty: draft !== null && tidyPublishing(draft) !== tidyPublishing(stored),
    commit: () => book && setPublishing(book.id, fields),
    discard: () => setDraft(null),
  });

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
      {/* At the foot of the window, and only once a field has been changed. */}
      <ToolSaveBar state={save} />
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
        <ListingDetails
          book={book}
          meta={fields}
          onChange={(patch) =>
            setDraft((current) => ({ ...(current ?? stored ?? {}), ...patch }))
          }
        />

        {/* **Says where the answers go, since the Save button now says when.**

            This used to promise "saved as you go", which was the whole of the
            acknowledgement on a screen with no next step — a claim a writer
            can only check by leaving and coming back. The button at the top
            right answers that question directly, so what is left here is the
            part it cannot say: these are facts about the book, they travel
            into every export, and none of it leaves the machine. */}
        <p className="mt-5 text-xs text-muted">
          Carried into every export. Nothing here is sent anywhere until you
          upload the file yourself.
        </p>
      </div>
    </div>
  );
}
