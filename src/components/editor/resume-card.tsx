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
export function ResumeCard({ book }: { book: Book }) {
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
    <section className="rounded-2xl border border-line bg-panel p-5">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <p className="text-xs font-bold tracking-widest text-muted uppercase">
          Where you left off
        </p>
        <p className="text-xs text-muted">
          {chapter.title} · {relativeTime(book.lastOpenedAt)}
        </p>
      </div>

      {paragraph && (
        // Set in the manuscript face, because it is manuscript. Seeing it in
        // the chrome's sans would make it read as a quotation about the book
        // rather than as the book.
        <p className="mt-3 font-serif text-[15px] leading-relaxed text-fg/90">
          {tail(paragraph)}
        </p>
      )}

      {hint && (
        <p className="mt-3 rounded-lg bg-raised px-3 py-2 text-sm text-muted">
          <span className="font-semibold text-fg">Your note:</span> {hint}
        </p>
      )}

      {/* Who is in the scene — the third thing this card was always meant to
          show, and the one that had to wait for the story bible to exist.
          Silent when the bible is empty rather than explaining itself: a writer
          who has not made one does not need to be told what they are missing
          every time they open a book. */}
      {who.length > 0 && (
        <p className="mt-2 text-sm text-muted">
          <span className="font-semibold text-fg">In this chapter:</span>{" "}
          {who.slice(0, 6).map((m) => m.entry.name).join(", ")}
        </p>
      )}

      <Link
        href={`/book/${book.id}/chapter/${chapter.id}`}
        className="mt-4 inline-block rounded-lg bg-accent px-5 py-2.5 text-sm font-semibold text-accent-ink"
      >
        Carry on
      </Link>
    </section>
  );
}
