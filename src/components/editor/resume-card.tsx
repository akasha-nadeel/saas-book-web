"use client";

import Link from "next/link";
import { mentionedIn } from "@/lib/bible";
import { lastParagraph, noteHint, tail } from "@/lib/resume";
import { chapterText } from "@/lib/search";
import { orderedChapters, type Book } from "@/lib/library-store";
import { relativeTime } from "@/lib/relative-time";
import { useBible, useChapterBody, useNotes } from "@/lib/use-library";

/**
 * Where you left off.
 *
 * **It has a home again: the dashboard's Overview**, in the slot the word-target
 * dial vacated on 2026-09-01 when the dial moved to the book card in Write
 * where the book it counts is. Mounted through `ResumeSlot` in
 * `shelf/bookshelf.tsx`, which asks `resumeChapter` first so a book with
 * nothing written yet gets a line saying so rather than an empty half-row.
 *
 * **It rendered nowhere for a month before that**, and the reason is worth
 * keeping: it sat on the book overview above the guide, and a hand's width to
 * its left the book panel's own card offered the same move under a different
 * name — two controls for one intention on one screen, with the *card* holding
 * the answer and the *button* looking like the way in. The button won there,
 * and it still holds that screen (see `openBook` in `book-panel.tsx`). What was
 * lost was a fight about *where a control goes*, not about whether the three
 * things this shows are worth showing — and on the dashboard there is no
 * competing control to lose to.
 *
 * Built for the writer who said they get seventeen uninterrupted minutes a day,
 * and the one who said it takes forever to get back into the groove after a
 * gap. Those are the same complaint: **most of a short session is spent
 * remembering, not writing**, and nothing on the market addresses it because
 * every writing app is built for somebody with two clear hours.
 *
 * So the card shows three things before the writer has to go looking for any of
 * them: the last paragraph of the chapter they were in, the first line of the
 * note they left themselves, and who is in the scene.
 *
 * **None of it is new data.** The paragraph is read back out of the manuscript,
 * the note is the chapter notes panel, and the names come from the story bible
 * — the feature is entirely in putting the three on the screen a writer lands
 * on rather than three clicks away from it.
 *
 * The names waited for the bible to exist and are silent without one. A writer
 * who has not made a bible does not need telling what they are missing every
 * time they open a book.
 */
export function ResumeCard({
  book,
  wide = false,
}: {
  book: Book;
  /**
   * Whether this card is spanning the whole row rather than sharing it.
   *
   * **Told rather than measured, and that is the right way round here.** A
   * container query would ask "am I wide?", which is a different question: on a
   * 1920px screen the *half* card is 810px and would answer yes, and then the
   * two cards in one row would be laid out differently from each other. What
   * decides this layout is whether anything is standing beside it, and the row
   * on Overview is the only thing that knows — it is the same answer that
   * drops the row to one column when `ProCard` draws nothing.
   *
   * Presentation only. It moves the button and holds the height; it must never
   * decide what the card *says*.
   */
  wide?: boolean;
}) {
  /**
   * The chapter the book remembers being in, and failing that the last one with
   * prose in it.
   *
   * `lastOpenedId` first because it is the literal answer to the question the
   * card is asking. The fallback covers the two cases it cannot: a book opened
   * on a machine that has not synced, and a remembered chapter that is empty —
   * a writer who opened chapter twelve to start it, wrote nothing, and closed
   * the laptop is not resuming there, and quoting an empty chapter back at them
   * would be worse than saying nothing.
   */
  const chapters = orderedChapters(book);
  const remembered = chapters.find(
    (c) => c.id === book.lastOpenedId && c.words > 0,
  );
  const chapter = remembered ?? [...chapters].reverse().find((c) => c.words > 0);

  const body = useChapterBody(chapter?.id ?? "");
  const notes = useNotes(chapter?.id ?? "");
  const bible = useBible(book.id);

  if (!chapter) return null;

  const paragraph = lastParagraph(body);
  const hint = noteHint(notes);
  const who = mentionedIn(chapterText("", body), bible);

  // Nothing to show but a link back. A chapter with a word count and no
  // readable body means the body is on another machine and has not synced yet.
  if (!paragraph && !hint) return null;

  return (
    /* `rounded-lg`, which is `ProCard`'s corner and not a taste: the two sit
       side by side in the same row on Overview, and two radii on one row read
       as two components borrowed from different places. */
    <section
      /* `sm:min-h-52` is `ProCard`'s own floor, not a number picked to look
         right: the two share a row, the grid stretches them to match, and
         spanning the width must not make this one shorter than it is when the
         banner is beside it.

         What to do with the spare room that floor creates is the one thing
         the two layouts answer differently. Sharing the row there is none, so
         `justify-center` moves nothing; spanning it, the words go to the top
         left and the button to the bottom right, and the room in between is
         the gap — which is `mt-auto` on the button rather than a
         `justify-*` here, since an auto margin takes the free space first. */
      className={`relative isolate flex flex-col overflow-hidden rounded-lg
                  border border-white/15 bg-panel p-5 text-white shadow-sm
                  sm:min-h-52 ${wide ? "" : "justify-center"}`}
    >
      <div
        aria-hidden
        className="absolute inset-0 -z-20 bg-cover"
        style={{
          backgroundImage: "url('/resume-card-background.jpg')",
          /* **78%, so the figure stands in the frame rather than being cut off
             at the neck.** The picture is 2752×1536 and the figure runs from
             about 58% to 85% of its height; `cover` on a card this wide and
             this short crops a band out of the middle, and at 48% that band
             stopped at the top of his head. Down here the whole of him lands
             inside it, with a little floor left under his feet. */
          backgroundPosition: "center 78%",
        }}
      />
      <div
        aria-hidden
        className="absolute inset-0 -z-10 bg-[linear-gradient(105deg,rgba(0,0,0,0.74)_0%,rgba(0,0,0,0.58)_48%,rgba(0,0,0,0.24)_100%)]"
      />
      {/* **The title takes the top left and the chapter line the top right, at
          both widths.** It was briefly stacked under the title across a banner;
          the corners are better — the heading and the small print are different
          kinds of thing, and a reader who wants to know *when* looks to the end
          of the line rather than under the name. The button below is the only
          part that moves with the width. */}
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h3 className="text-base font-bold text-white">Where you left off</h3>
        <p className="text-xs text-white/70">
          {chapter.title} · {relativeTime(book.lastOpenedAt)}
        </p>
      </div>

      <div className="min-w-0">
        {paragraph && (
          /* **One face for both states of this card.**
           *
           * This was `font-serif`, and the argument for it is still a good
           * one: the line is manuscript, and the chrome's sans makes it read
           * as a quotation *about* the book rather than as the book. What
           * settled it is that the card has two states — this one and the
           * "nothing written yet" line in `ResumeSlot` — and they sat side by
           * side in the same slot in two different faces, which reads as two
           * cards rather than one card with something to say. The owner asked
           * for the sans; it is not an oversight, and the serif is not to be
           * restored without changing the empty state with it.
           */
          <p className="mt-3 text-sm leading-relaxed text-white/85">
            {tail(paragraph)}
          </p>
        )}

        {hint && (
          <p className="mt-3 rounded-lg border border-white/15 bg-black/30 px-3 py-2 text-sm text-white/80 shadow-sm backdrop-blur-[2px]">
            <span className="font-semibold text-white">Your note:</span> {hint}
          </p>
        )}

        {/* Who is in the scene — the third thing this card was always meant
            to show, and the one that had to wait for the story bible to
            exist. Silent when the bible is empty rather than explaining
            itself: a writer who has not made one does not need to be told
            what they are missing every time they open a book. */}
        {who.length > 0 && (
          <p className="mt-2 text-sm text-white/75">
            <span className="font-semibold text-white">In this chapter:</span>{" "}
            {who.slice(0, 6).map((m) => m.entry.name).join(", ")}
          </p>
        )}
      </div>

      {/* **Bottom right when it spans, under the words when it shares.**
          `self-end` rather than a text alignment, because it is a flex child
          and would otherwise stretch the width of the card; `mt-auto` is what
          puts it on the floor rather than directly under the prose. `self-start`
          in the narrow layout does the same job in reverse — without it the
          button would run the full width of the column. */}
      <Link
        href={`/book/${book.id}/chapter/${chapter.id}`}
        className={`rounded-lg bg-white px-5 py-2.5 text-sm font-semibold text-neutral-950 shadow-sm outline-none transition hover:bg-white/90 focus-visible:ring-2 focus-visible:ring-white/70 ${
          wide ? "mt-auto self-end" : "mt-4 self-start"
        }`}
      >
        Carry on
      </Link>
    </section>
  );
}
