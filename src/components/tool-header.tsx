"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { BookCover } from "@/components/shelf/book-cover";
import { areaLabel } from "@/lib/areas";
import {
  bookChapterCount,
  bookWordCount,
  type Book,
} from "@/lib/library-store";
import { useCover } from "@/lib/use-library";

/**
 * The head of a tool screen: what this page is, and which book it is about.
 *
 * Every tool opens at `/book/<uuid>/<tool>` and fills the window — no rail, no
 * dashboard, nothing but itself. So it has to answer two questions on its own,
 * and the order they go in matters.
 *
 * **The tool's name is the heading.** It was briefly only the last breadcrumb,
 * with the book's title set large underneath, on the reasoning that a heading
 * would repeat the crumb. That was wrong: it left the biggest words on the page
 * naming the *context* rather than the page, so every screen looked like the
 * same screen with different contents. A page is what it does.
 *
 * **The book identifies the block rather than sitting in a chip of its own.**
 * The cover is the part that does the work — a writer knows their own covers on
 * sight and has to *read* a title — and it matters because the Tools area lets
 * them switch books before opening one, so landing on the wrong manuscript's
 * export screen is a real way to lose ten minutes.
 *
 * It used to be a bordered pill on its own line, and that arrangement made this
 * header four separate bands: a trail, a pill, a heading, a paragraph — each
 * starting at the same left edge, none aligned to anything, and the pill the
 * loudest thing on a screen where the heading should be. A capsule with a
 * border also reads as a *tag*, which is the wrong idea: this is the book, not
 * a label applied to something else.
 *
 * So the cover moved out to the left and the rest hangs off it as one block —
 * whose book, then what the page is, then what it does, in the order somebody
 * needs them. One optical left edge for the text, one object beside it, and the
 * heading is the biggest thing again.
 */

/**
 * The column widths the tool pages use.
 *
 * Passed in rather than fixed, because the header's contents have to line up
 * with the page's — the bar spans the window but what is written on it must
 * start at the same left edge as the first card below it. Written out rather
 * than interpolated: Tailwind reads class names as literals and would ship no
 * rule for a name built at runtime.
 */
const WIDTHS = {
  "3xl": "max-w-3xl",
  "4xl": "max-w-4xl",
  "5xl": "max-w-5xl",
  /* No cap at all, for a screen whose own column is already narrow — the
     roadmap when a step's tool is open beside it. Centring a 48rem column
     inside a 24rem one does nothing, but the `mx-auto` would still push the
     contents off the page's left edge if the cap ever mattered. */
  full: "max-w-none",
} as const;

export function ToolHeader({
  book,
  /** Short name for the trail — the word a writer looked for in the launcher. */
  tool,
  /**
   * The heading, where the page calls itself something longer than its tile
   * does. Defaults to `tool`, which is right for most of them.
   */
  title,
  /** Must match the page's own container, or the two edges disagree. */
  width = "3xl",
  /** One line under the heading, if the tool has something to say up front. */
  children,
}: {
  book: Book;
  tool: string;
  title?: string;
  width?: keyof typeof WIDTHS;
  children?: React.ReactNode;
}) {
  const cover = useCover(book.id);

  /*
   * Where the writer came from, if whoever linked here said so.
   *
   * "All tools" is a shortcut to the launcher, not a way back — it was the only
   * exit on this screen, so somebody who pressed "Choose categories" on a
   * finding in Prepare landed in the Tools wall when they were done and had to
   * find their way to Prepare again to see the rest of the list they were
   * working through. A back control has to name the place it returns to, and
   * only the caller knows it.
   */
  const fromId = useSearchParams().get("from");
  const from = areaLabel(fromId);

  return (
    <header className="border-b border-line bg-panel">
      <div className={`mx-auto ${WIDTHS[width]} px-6 py-5`}>
        <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
          <nav
            aria-label="Breadcrumb"
            className="flex min-w-0 flex-wrap items-center gap-1.5 text-xs text-muted"
          >
            <Link href="/" className="hover:text-fg">
              Books
            </Link>
            <span aria-hidden="true">›</span>
            <Link href={`/book/${book.id}`} className="truncate hover:text-fg">
              {book.title}
            </Link>
            <span aria-hidden="true">›</span>
            <span className="font-semibold text-fg">{tool}</span>
          </nav>

          {/* Beside the trail rather than in it. The breadcrumb describes where
              this page sits — a tool belongs to a book — and the launcher is
              not its parent: the same screen is reached from the book cards,
              from Prepare and from the roadmap. This is a shortcut back to the
              wall of them, which is a different claim and belongs in a
              different control.

              A plain link, not a bordered button. It is the least important
              thing in this header and a box gave it the weight of an action —
              which put a second heavy element on the one row that should be
              quiet. */}
          {/* The way back names where it goes. When a caller said where the
              writer came from, that wins — returning them to the launcher when
              they arrived from a list they were working through is the thing
              this exists to stop. "All tools" stays for everyone else. */}
          <Link
            href={from ? `/?area=${fromId}` : "/?area=tools"}
            className="shrink-0 text-xs font-semibold text-muted hover:text-fg"
          >
            ← {from ? `Back to ${from}` : "All tools"}
          </Link>
        </div>

        {/* Cover, then the whole of the text hanging off it.

            `items-start` and not `items-center`: the block is three lines of
            different weights, and centring it against the cover would leave
            the heading floating at whatever height the description happened to
            make. The top edges agree instead. */}
        <div className="mt-4 flex items-start gap-4">
          {/* Linked, because the cover is what a writer reaches for the moment
              they see it is the wrong book. Shadowed rather than bordered so it
              reads as an object on the page instead of a framed thumbnail. */}
          <Link
            href={`/book/${book.id}`}
            aria-label={`Open ${book.title}`}
            className="w-11 shrink-0 overflow-hidden rounded-sm shadow-[0_1px_2px_rgba(0,0,0,0.18),0_6px_12px_-6px_rgba(0,0,0,0.35)]
                       transition-transform hover:-translate-y-0.5 sm:w-12"
          >
            <BookCover
              title={book.title}
              words={bookWordCount(book)}
              seed={book.id}
              image={cover}
              {...(book.subtitle ? { subtitle: book.subtitle } : {})}
              {...(book.author ? { author: book.author } : {})}
              {...(book.bareCover ? { bare: true } : {})}
            />
          </Link>

          <div className="min-w-0 flex-1">
            {/* Whose book, small and above — the eyebrow the heading needed.
                It was a pill on its own row and is now a line of type, which
                is all it ever had to be. */}
            <p className="flex min-w-0 flex-wrap items-baseline gap-x-2 text-xs">
              <Link
                href={`/book/${book.id}`}
                className="truncate font-semibold text-fg hover:text-accent"
              >
                {book.title}
              </Link>
              <span className="whitespace-nowrap text-muted">
                {bookChapterCount(book).toLocaleString()}{" "}
                {bookChapterCount(book) === 1 ? "chapter" : "chapters"} ·{" "}
                {bookWordCount(book).toLocaleString()}{" "}
                {bookWordCount(book) === 1 ? "word" : "words"}
              </span>
            </p>

            <h1 className="mt-1 text-2xl font-extrabold tracking-tight text-fg">
              {title ?? tool}
            </h1>

            {/* Capped at a readable measure. Running the full width of a 5xl
                page gave a line nobody wants to read twice, and it was most of
                why this header looked loose. */}
            {children && (
              <p className="mt-1.5 max-w-2xl text-sm leading-relaxed text-muted">
                {children}
              </p>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}
