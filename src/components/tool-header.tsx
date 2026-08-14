"use client";

import { useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { BookCover } from "@/components/shelf/book-cover";
import { CoverDialog } from "@/components/shelf/cover-dialog";
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
  /* Wider still, for a grid whose whole job is to be scanned at once — the
     title check puts a shelf of covers under a one-line answer, and every
     extra column is a book a reader takes in without scrolling. */
  "7xl": "max-w-7xl",
  /* For a screen that is a grid of pictures rather than a column of prose.
     Reading wants a narrow measure; twenty covers want the room, and at 4xl
     they sat in a 56rem column with a third of a wide window empty on either
     side. Only comps takes this so far — the covers wall is bare artwork at a
     size the writer sets, so it still reads at 5xl. */
  "6xl": "max-w-6xl",
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
  /**
   * Must match the page's own container, or the two edges disagree.
   *
   * **One measure for every tool, so the margins do not jump between them.**
   * It was `5xl` with three screens opting wider, which meant walking from the
   * blurb to the comps moved both edges of the page. The widest of them is now
   * the default and the opt-outs are gone. Every page caps its own prose, so a
   * wider container never widens a line of body text — it only stops wasting
   * the sides of an ordinary laptop. The deck is the one thing here that does
   * run the whole width, and it is held short enough to take it.
   *
   * **The default is a page width, not a reading measure.** It was `3xl` — 768
   * pixels — which is right for a column of prose and wrong for what these
   * screens actually hold: forms, stat rows, card grids and drawn figures. On
   * an ordinary laptop that left a third of the window empty down each side
   * while the content crowded itself in the middle. Every page still caps its
   * own prose, so a wider container never widens a line of body text.
   */
  width = "7xl",
  /**
   * The tool's Save control, drawn at the top right.
   *
   * A slot rather than the button itself, because only the screen knows
   * whether it holds a draft — and because the same control has to appear in
   * the roadmap's panel, where this header is not rendered at all. It sits on
   * the heading's row and not the breadcrumb's: the trail is the quietest row
   * on the page and a filled button there would be the loudest thing in it.
   */
  action,
  /** One line under the heading, if the tool has something to say up front. */
  children,
}: {
  book: Book;
  tool: string;
  title?: string;
  width?: keyof typeof WIDTHS;
  action?: React.ReactNode;
  children?: React.ReactNode;
}) {
  const cover = useCover(book.id);
  /* The details dialog, mounted here rather than on each of the fifteen tool
     screens: this component is the only thing all of them share, and it is
     already the one place that draws the book. */
  const [editing, setEditing] = useState(false);

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
    /* **A card, like everything under it.** The header used to be a full-bleed
       band with a hairline under it — the shape a page header takes when it is
       the only thing on the screen that is not a card. Every tool now works in
       boxes, and a band above a column of them reads as chrome the page is
       sitting in rather than as the first thing on the page. Boxed, the screen
       is one stack: what this is, then what it does.

       The band survives as the ground the card sits on, which is what keeps
       the top of the page distinct from the working area without a rule. */
    <header className="bg-surface">
      <div className={`mx-auto ${WIDTHS[width]} px-6 pt-6`}>
        <div className="rounded-2xl border border-line bg-panel p-5 @2xl:p-6">
          <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
            <nav
              aria-label="Breadcrumb"
              className="flex min-w-0 flex-wrap items-center gap-1.5 text-xs text-muted"
            >
              <Link href="/" className="hover:text-fg">
                Books
              </Link>
              <span aria-hidden="true">›</span>
              <Link
                href={`/book/${book.id}`}
                className="truncate hover:text-fg"
              >
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
            {/* **It opens "Edit book details" now, and it used to open the
              book.** The old note is worth keeping because the need it named
              is real: the cover is what a writer reaches for the moment they
              see it is the wrong book. That escape survives — the title beside
              it is a link to `/book/<id>`, and the breadcrumb above it is
              another — so what the picture gives up is a third copy of the
              same route, and what it gains is the one control a writer wants
              while *looking at a cover*: the title, the byline, the artwork,
              and whether our words go over theirs.

              Shadowed rather than bordered so it reads as an object on the
              page instead of a framed thumbnail. */}
            <button
              type="button"
              onClick={() => setEditing(true)}
              aria-label={`Edit title, author and cover for ${book.title}`}
              className="w-11 shrink-0 cursor-pointer overflow-hidden rounded-sm shadow-[0_1px_2px_rgba(0,0,0,0.18),0_6px_12px_-6px_rgba(0,0,0,0.35)]
                       outline-none transition-transform hover:-translate-y-0.5
                       focus-visible:ring-2 focus-visible:ring-accent/60 sm:w-12"
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
            </button>

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

              {/* A step up from 2xl. This is the name of the screen a writer
                deliberately navigated to, and it was sitting at the same size
                as a section heading inside the page under it — the thing that
                says where you are should not be the same weight as the things
                that say what is on the shelf. Held back on a phone, where 3xl
                wraps a two-word tool name onto two lines. */}
              <h1 className="mt-1 text-2xl font-extrabold tracking-tight text-fg sm:text-3xl">
                {title ?? tool}
              </h1>

              {/* **It runs the header's own width, on every tool.** The cap was
                `2xl` with a `deckWidth` prop to escape it, and five of the
                sixteen screens had already taken the escape — at which point
                the default was the exception, and walking between two tools
                changed where the sentence under the heading stopped. A deck
                stacked into a narrow column beside an acre of empty header
                reads as a page that failed to fill itself.

                **The obligation moved to the words.** A cap forgives a long
                deck by wrapping it; the full width does not, so a deck is now
                held to a sentence or two. Anything longer belongs on the page
                below, where a tool's own prose caps itself at `max-w-prose`
                and is read rather than glanced at.

                **Not `text-muted`**, which is the grey this app spends on
                metadata: a chapter count, a date, a figure's provenance. This
                is the sentence the heading is asking to be read, and on most
                of these screens it is the only explanation of what the tool is
                for. So it takes the page's own ink held slightly back, the
                same treatment the pricing page's deck already uses, with the
                weight lifted to match. */}
              {children && (
                <p className="mt-2 text-base leading-relaxed font-medium text-fg/75">
                  {children}
                </p>
              )}
            </div>

            {action}
          </div>
        </div>
      </div>

      {/* A `<dialog>` opened with `showModal` sits in the browser's top layer,
          so it clears the roadmap's sheet and any tool's own chrome without a
          z-index to keep in step with either — the same reason the export
          screen mounts its done dialog where it does. */}
      {editing && <CoverDialog book={book} onClose={() => setEditing(false)} />}
    </header>
  );
}
