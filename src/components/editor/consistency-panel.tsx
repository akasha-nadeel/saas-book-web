"use client";

/**
 * The consistency check, in the rail's panel.
 *
 * **One engine, two windows** — `lib/consistency.ts` judges for both this and
 * the full screen, and `lib/book-text.ts` reads the book for both. Two copies
 * of either would be two answers to one question.
 *
 * ## The shape of a card
 *
 * A card per finding, and inside it a box per spelling — the same anatomy as
 * the full page, so a writer who has seen one recognises the other. What is
 * tighter here is only the spacing and the type; the structure is the page's.
 *
 * Three things about the *content* were wrong in the first version and are
 * fixed here. They are worth writing down because each is easy to put back:
 *
 * **The locations were on the wrong half.** Eight chapter chips for the
 * spelling that is *right* and one for the spelling that is wrong — and nobody
 * has ever wanted to visit the twenty-two correct uses. For the common form the
 * count is the whole story; for the rare form the location is. So a lopsided
 * finding gives the rare spelling a box and the common one a single line.
 *
 * **The odd one out came second.** The commonest spelling led, which is the
 * order of the data and the opposite of the order of the question. The thing a
 * writer acts on goes first.
 *
 * **Not every finding is the same shape.** Some are lopsided — one use against
 * twenty-two, and there is a likely answer. Some are even — grey once, gray
 * once, neither wrong, the book simply does both. Some are a single occurrence
 * with no comparison in them at all. Drawing all three identically is what made
 * a trivial finding look exactly like a real one.
 *
 * **No score and no severity is invented.** Lopsided or even is a fact about
 * two counts, not a grade.
 */

import { useLayoutEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";

import { namesOf } from "@/lib/bible";
import { bookTextOf, readable } from "@/lib/book-text";
import {
  consistencyReport,
  withDismissal,
  withoutDismissal,
  type ConsistencyFinding,
  type ConsistencyReport,
  type Variant,
  type Where,
} from "@/lib/consistency";
import {
  findBook,
  saveConsistencyRaw,
  type Book,
} from "@/lib/library-store";
import { plural } from "@/lib/plural";
import {
  useBible,
  useDismissals,
  useHydrated,
  useShelf,
} from "@/lib/use-library";

const LABELS: Record<ConsistencyFinding["check"], string> = {
  names: "A name spelled two ways",
  spelling: "British and American",
  hyphens: "Hyphenation",
  quotes: "Quotation marks",
  doubled: "A word typed twice",
  unclosed: "A quotation mark left open",
};

/**
 * How many times over the rarer spelling the commoner one has to be used
 * before the pair reads as one spelling and a slip, rather than as two things
 * the book does both of.
 *
 * The same four the name check uses to decide a pair is worth reporting at all.
 * This is the presentation side of that one fact.
 */
const LOPSIDED = 4;

/**
 * A hue per kind of finding, for the card it sits on.
 *
 * **This spends colour, which the house rule normally forbids** — the accent is
 * reserved for "this is the way forward" and nothing else in the chrome may
 * take a hue. The precedent it follows is the tool marks, which carry one each
 * for the same job: telling one category from another at a glance, on a screen
 * that is a list of categories. Here the panel is a stack of cards a writer
 * scans rather than reads, and the kind of finding is the first thing they are
 * sorting by.
 *
 * **Mixed with transparency rather than stated as a colour**, so one value
 * serves both themes: eight per cent of a hue over near-white is a pale tint,
 * and over near-black it is a dark one. A literal pale green would be a white
 * card at night.
 *
 * The text on the card keeps its own tokens. The tint is background only —
 * a hue behind eleven-pixel type is a contrast problem, and the label already
 * says which check this is in words.
 */
const HUES: Record<ConsistencyFinding["check"], string> = {
  names: "#10b981",
  spelling: "#8b5cf6",
  quotes: "#3b82f6",
  doubled: "#ec4899",
  // Not asked for, but a grey card among four coloured ones reads as one that
  // failed to load rather than as one with no colour of its own.
  hyphens: "#f59e0b",
  unclosed: "#14b8a6",
};

const tint = (check: ConsistencyFinding["check"]) => ({
  backgroundColor: `color-mix(in srgb, ${HUES[check]} 16%, transparent)`,
  borderColor: `color-mix(in srgb, ${HUES[check]} 45%, transparent)`,
});

/**
 * The last report per book, kept for the length of the session.
 *
 * **Because opening a chapter throws this component away.** A route change
 * replaces the editor's subtree, and the panel's `useState` goes with it — so a
 * writer who ran the check and then followed one of its own chapter links
 * arrived back at the "Run the check" button, having lost the very list they
 * were working through. The panel surviving that (see `panelTab` in
 * `library-store.ts`) only made the emptiness more obvious.
 *
 * Module-level and not stored: a report is *derived*, it is worthless the
 * moment the manuscript moves, and it costs a couple of hundred milliseconds to
 * make again. Keeping it in `localStorage` would buy a stale answer surviving a
 * reload, which is the opposite of what is wanted.
 */
const CACHE = new Map<
  string,
  { report: ConsistencyReport; signature: string; scroll: number }
>();

/**
 * What the book looked like when the check ran.
 *
 * Chapter ids and their word counts, straight off the shelf — no bodies are
 * read, so this is free. It is not a checksum of the prose and does not need to
 * be: it moves whenever a chapter is written in, added or removed, which is
 * every case where the report has stopped being true.
 */
const signatureOf = (book: Book) =>
  readable(book)
    .map((chapter) => `${chapter.id}:${chapter.words}`)
    .join("|");

export function ConsistencyPanel({ bookId }: { bookId: string }) {
  const hydrated = useHydrated();
  const shelf = useShelf();
  const book = findBook(shelf, bookId);
  const bible = useBible(bookId);
  const dismissals = useDismissals(bookId);

  const [running, setRunning] = useState(false);
  const [report, setReport] = useState<ConsistencyReport | null>(
    () => CACHE.get(bookId)?.report ?? null,
  );

  const toRead = useMemo(() => (book ? readable(book).length : 0), [book]);

  /*
   * Whether the book has been written in since this report was made.
   *
   * Said out loud rather than quietly re-run: a report that redoes itself on
   * every navigation would read every chapter each time a writer followed a
   * link, and a report that stays silent about being old is the same mistake
   * as an empty result rendered as a good one.
   */
  const stale =
    report !== null &&
    book !== null &&
    CACHE.get(bookId)?.signature !== signatureOf(book);

  /*
   * **Where the writer had scrolled to, kept with the report.**
   *
   * The findings survive a chapter navigation now, and landing back at the top
   * of them is its own small betrayal: somebody four findings down, clicking
   * the chapters of the fourth, was returned to the first every time. Restored
   * before paint rather than after, or the list is visibly thrown to the top
   * and dragged back.
   */
  const listRef = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const held = CACHE.get(bookId)?.scroll;
    if (listRef.current && held) listRef.current.scrollTop = held;
  }, [bookId]);

  const run = () => {
    if (!book) return;
    setRunning(true);
    // Paint the pressed state before the reading starts. A few hundred
    // milliseconds of dead button is worse than the same wait, admitted.
    requestAnimationFrame(() => {
      const known = bible.map((entry) => namesOf(entry));
      const next = consistencyReport(bookTextOf(book), { known });
      // A fresh report is a fresh list, so the old scroll offset means nothing.
      CACHE.set(bookId, {
        report: next,
        signature: signatureOf(book),
        scroll: 0,
      });
      setReport(next);
      setRunning(false);
    });
  };

  const setAside = useMemo(
    () => new Set(dismissals.map((row) => row.key)),
    [dismissals],
  );
  const showing = report?.findings.filter((f) => !setAside.has(f.key)) ?? [];
  const hidden = report?.findings.filter((f) => setAside.has(f.key)) ?? [];

  const dismiss = (key: string) =>
    saveConsistencyRaw(bookId, JSON.stringify(withDismissal(dismissals, key)));
  const restore = (key: string) =>
    saveConsistencyRaw(bookId, JSON.stringify(withoutDismissal(dismissals, key)));

  if (!hydrated || !book) return null;

  if (toRead === 0) {
    return (
      <p className="p-3 text-sm text-muted">
        Nothing written yet in the body of this book.
      </p>
    );
  }

  return (
    <div className="flex h-full flex-col">
      {!report ? (
        <div className="p-3">
          <p className="text-sm leading-relaxed text-muted">
            Reads all {plural(toRead, "chapter")} at once and reports what this
            book spells more than one way — a name, a spelling, a quotation
            mark.
          </p>
          <button
            type="button"
            onClick={run}
            disabled={running}
            className="mt-3 w-full rounded-lg bg-accent px-3 py-2 text-sm font-semibold text-accent-ink hover:opacity-90 disabled:opacity-60"
          >
            {running ? `Reading ${plural(toRead, "chapter")}…` : "Run the check"}
          </button>
        </div>
      ) : (
        <>
          {/* What was read, and the way to read it again — held apart from the
              findings by a rule, because it is about the run and not about the
              book. */}
          <div className="flex items-center justify-between gap-2 border-b border-line px-3 py-2">
            <p className="min-w-0 text-xs text-muted">
              {plural(report.chapters, "chapter")} ·{" "}
              {plural(report.words, "word")}
              {stale && (
                /* Never quietly. A report that has stopped being true about
                   the book says so, and the way to make a true one is the
                   button already beside it. */
                <span className="block text-note-fg">
                  The book has changed since this ran.
                </span>
              )}
            </p>
            <button
              type="button"
              onClick={run}
              disabled={running}
              className="rounded-md border border-line px-2 py-1 text-xs font-semibold text-muted hover:bg-raised hover:text-fg disabled:opacity-60"
            >
              {running ? "Reading…" : "Again"}
            </button>
          </div>

          {/* `scroll-slim` rather than the browser's default bar: 8px, a
              floating thumb and no arrow buttons. The default is a wide dark
              gutter here, which in a pale panel reads as a black stripe down
              the edge of the findings. */}
          <div
            ref={listRef}
            onScroll={(e) => {
              // Straight onto the cache entry rather than into state: this
              // fires on every frame of a scroll, and re-rendering the whole
              // list for a number nothing draws would be a waste of a frame.
              const held = CACHE.get(bookId);
              if (held) held.scroll = e.currentTarget.scrollTop;
            }}
            className="scroll-slim min-h-0 flex-1 overflow-y-auto p-3"
          >
            {showing.length === 0 ? (
              /* Never a tick, never "clean" — and never "nothing came back"
                 when the only reason it is empty is that the writer put it all
                 away, which would be untrue about their book. */
              <p className="text-sm leading-relaxed text-muted">
                {hidden.length > 0
                  ? "Nothing left to show — everything found is set aside, below."
                  : "Nothing came back. That is six specific checks finding nothing, not a verdict on the book."}
              </p>
            ) : (
              <ul className="space-y-3">
                {showing.map((finding) => (
                  <Card
                    key={finding.key}
                    bookId={bookId}
                    finding={finding}
                    onDismiss={dismiss}
                  />
                ))}
              </ul>
            )}
          </div>
        </>
      )}

      {/* **There is always a way back.** A dismissal kept in storage that the
          writer cannot find again is a trap rather than a preference. */}
      {hidden.length > 0 && (
        <details className="group border-t border-line px-3 py-2">
          <summary className="cursor-pointer text-[11px] font-semibold text-muted hover:text-fg">
            <span className="group-open:hidden">
              Show the {plural(hidden.length, "one")} you set aside
            </span>
            <span className="hidden group-open:inline">Hide these again</span>
          </summary>
          <ul className="mt-2 space-y-1">
            {hidden.map((finding) => (
              <li
                key={finding.key}
                className="flex items-center justify-between gap-2"
              >
                <span className="min-w-0 truncate text-[11px] text-fg/70">
                  {finding.label}
                </span>
                <button
                  type="button"
                  onClick={() => restore(finding.key)}
                  className="shrink-0 text-[11px] font-semibold text-accent hover:underline"
                >
                  Put back
                </button>
              </li>
            ))}
          </ul>
        </details>
      )}

      <div className="border-t border-line px-3 py-2">
        <Link
          href={`/book/${bookId}/consistency`}
          className="text-[11px] font-semibold text-accent hover:underline"
        >
          Open the full check →
        </Link>
      </div>
    </div>
  );
}

/**
 * One finding — the card, and inside it a box for each spelling worth going to.
 *
 * The three shapes are the whole point of the branch below: a lopsided pair
 * leads with the odd one out and demotes the common spelling to a sentence, an
 * even pair gives both boxes at one size, and a single occurrence is not a
 * comparison at all.
 */
function Card({
  bookId,
  finding,
  onDismiss,
}: {
  bookId: string;
  finding: ConsistencyFinding;
  onDismiss: (key: string) => void;
}) {
  const common = finding.variants[0];
  const rare = finding.variants[1];
  const lopsided =
    finding.variants.length === 2 && common.count >= rare.count * LOPSIDED;

  return (
    <li className="rounded-xl border p-3" style={tint(finding.check)}>
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-[11px] font-semibold tracking-wide text-muted uppercase">
            {LABELS[finding.check]}
          </p>
          <h3 className="mt-0.5 text-base font-bold break-words text-fg">
            {finding.label}
          </h3>
        </div>
        {/* Worded rather than a ✕. A cross is smaller, easier to hit by
            accident, and reads as "delete" — this is the writer saying the
            book is right and the check is wrong. */}
        <button
          type="button"
          onClick={() => onDismiss(finding.key)}
          className="shrink-0 rounded-md border border-line px-2 py-1 text-[11px] font-semibold text-muted hover:bg-raised hover:text-fg"
        >
          Not a mistake
        </button>
      </div>

      <div className="mt-2 space-y-2">
        {lopsided ? (
          <Spelling
            bookId={bookId}
            variant={rare}
            rare
            hue={HUES[finding.check]}
            example={finding.passages?.[0]?.text}
          />
        ) : (
          finding.variants.map((variant) => (
            <Spelling
              key={variant.text}
              bookId={bookId}
              variant={variant}
              rare={finding.variants.length === 1}
              hue={HUES[finding.check]}
              example={finding.passages?.[0]?.text}
            />
          ))
        )}
      </div>

      {lopsided && (
        /* The common spelling, as context rather than as a destination. No
           chips: there is nothing here anybody goes to look at. */
        <p className="mt-2 text-xs text-muted">
          <span className="font-mono text-fg/70">{common.text}</span> is used{" "}
          {plural(common.count, "time")} elsewhere.
        </p>
      )}

      <details className="group mt-2">
        <summary className="cursor-pointer text-[11px] font-semibold text-muted hover:text-fg">
          <span className="group-open:hidden">Why this is here</span>
          <span className="hidden group-open:inline">Close</span>
        </summary>
        <p className="mt-1 text-xs leading-relaxed text-muted">
          {finding.note}
        </p>
      </details>
    </li>
  );
}

/** One spelling: what it is, how often, where, and how it reads on the page. */
function Spelling({
  bookId,
  variant,
  rare,
  hue,
  example,
}: {
  bookId: string;
  variant: Variant;
  rare?: boolean;
  /** The card's colour, so the links inside it belong to it. */
  hue: string;
  example?: string;
}) {
  const sentence = variant.example ?? example;
  return (
    <div
      /* A paler wash of the card's own hue, not the neutral surface token.
         Mixed with `--color-panel` rather than with transparency, and that is
         the whole trick: a transparent tint would sit *on top of* the card's
         16% and come out darker than it. Mixing toward the panel replaces the
         colour instead of adding to it, so seven per cent reads as a lighter
         version of the sixteen behind it — and still resolves the right way
         at night, where `--color-panel` is near-black rather than white. */
      style={{
        backgroundColor: `color-mix(in srgb, ${hue} 7%, var(--color-panel))`,
        borderColor: `color-mix(in srgb, ${hue} 25%, transparent)`,
      }}
      className="rounded-lg border p-2"
    >
      <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
        <span
          className={`rounded px-2 py-0.5 font-mono text-sm font-semibold ${
            rare ? "bg-note-bg text-note-fg" : "bg-raised text-fg"
          }`}
        >
          {variant.text}
        </span>
        <span className="text-xs text-muted">
          {plural(variant.count, "time")} in the book
        </span>
      </div>

      <Chapters bookId={bookId} where={variant.where} hue={hue} />

      {sentence && (
        <p className="mt-1.5 line-clamp-2 text-[13px] leading-relaxed text-fg/70">
          {marked(sentence, variant.text)}
        </p>
      )}
    </div>
  );
}

/** How many chapters are named before the rest become a count. */
const CHAPTER_LIMIT = 4;

/**
 * The chapters one spelling is in, as links.
 *
 * A chapter with no number falls back to its own title and is truncated, so
 * one long name cannot set the width of the row.
 */
function Chapters({
  bookId,
  where,
  hue,
}: {
  bookId: string;
  where: readonly Where[];
  hue: string;
}) {
  const shown = where.slice(0, CHAPTER_LIMIT);
  return (
    <div className="mt-1.5 flex flex-wrap items-center gap-1">
      {shown.map((at) => (
        <Link
          key={at.chapterId}
          href={`/book/${bookId}/chapter/${at.chapterId}`}
          title={at.chapterTitle}
          /* The accent, because these are the only things on the card that go
             anywhere — the house rule reserves the hue for "this is the way
             forward" and a link into the chapter is exactly that. It is the
             brand blue by day and white at night, which is what
             `--color-accent` is for; hard-coding a blue would leave a blue pill
             on a black panel. */
          /* The card's own hue rather than the accent. These sit inside a
             tinted card, and a blue link on a green card reads as something
             borrowed from elsewhere on the screen. Mixed with transparency
             like the card itself, so one value serves both themes. */
          style={{
            backgroundColor: `color-mix(in srgb, ${hue} 20%, transparent)`,
            borderColor: `color-mix(in srgb, ${hue} 45%, transparent)`,
          }}
          /* `text-fg`, not a literal black: it is near-black by day and white
             at night, and a black label on the dark card these pills sit on at
             night would be unreadable. The pill keeps its colour in the fill
             and the edge; the words stay the text colour everything else on
             the card uses. */
          className="max-w-[8rem] truncate rounded-full border px-2 py-0.5 text-[11px] font-semibold text-fg hover:brightness-110"
        >
          {at.number === null ? at.chapterTitle : `ch ${at.number}`}
          <span className="ml-1 text-accent/60">×{at.count}</span>
        </Link>
      ))}
      {where.length > shown.length && (
        <span className="text-[11px] text-muted">
          +{where.length - shown.length}
        </span>
      )}
    </div>
  );
}

/**
 * The writer's own sentence, with the spelling marked.
 *
 * Returns nodes and never markup: this text is the manuscript, and a
 * highlighter that builds an HTML string is one edit away from putting a
 * writer's own angle brackets through `dangerouslySetInnerHTML`.
 */
function marked(text: string, mark: string): React.ReactNode {
  const words = mark.trim().split(/\s+/).filter(Boolean).map(escapeRe);
  if (words.length === 0) return text;

  const pattern =
    words.length === 1 && /^\p{L}/u.test(mark)
      ? `\\b(${words[0]})\\b`
      : `(${words.join("\\s+")})`;

  return text
    .split(new RegExp(pattern, "gi"))
    .map((part, at) =>
      at % 2 === 1 ? (
        <mark key={at} className="rounded bg-note-bg px-0.5 text-note-fg">
          {part}
        </mark>
      ) : (
        part
      ),
    );
}

const escapeRe = (value: string) =>
  value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
