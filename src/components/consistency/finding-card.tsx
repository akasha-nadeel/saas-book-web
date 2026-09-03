"use client";

/**
 * One finding, as a card in the check's own colour.
 *
 * **Shared by the full screen and the rail's panel**, because two copies of
 * this would be two answers to one question — the same reason
 * `lib/consistency.ts` judges for both. There is no `dense` prop and there must
 * not be one: the panel is narrower, not different, so the card reads its own
 * width with `@container` and nothing is passed to it. A flag here would be the
 * `embedded` mistake in miniature, and `tool-page.ts` already records where
 * that goes.
 *
 * ## This puts nested cards back, which a house rule took away
 *
 * `docs/styling.md` names this screen as the thing the grouped-list language
 * was written against — *"the consistency page nested cards two deep"*. The
 * rule it broke is about **boxes that are peers and look identical**: six grey
 * bordered cards is a pile, because the border is spent drawing a separation
 * the eye already had.
 *
 * A finding is not a peer of the finding under it. It is a small document about
 * one word, and its nesting is what the thing *is* — a spelling contains its
 * chapters, a chapter contains its sentence. The card's ground carries which
 * check this is, so six findings are six recognisable things rather than six
 * identical ones. The grouped list stays right where it was written for:
 * chapters, versions, search results — lists of genuine peers.
 *
 * ## Two levels, not three
 *
 * The card, and one box per spelling. The chapters inside a box are separated
 * by a hairline rather than boxed again — three levels was drawn once and is
 * the pile arriving by another door.
 */

import Link from "next/link";

import { SwitchTrack } from "@/components/ui/switch";
import { CHECK_LOOK } from "@/lib/consistency-checks";
import type {
  ConsistencyFinding,
  Occurrence,
  Variant,
  Where,
} from "@/lib/consistency";
import { plural } from "@/lib/plural";

/**
 * How many times over the rarer spelling the commoner has to be used before the
 * pair reads as one spelling and a slip, rather than as two things the book
 * does both of. The same four the name check uses to decide a pair is worth
 * reporting at all; this is the presentation side of that one fact.
 */
const LOPSIDED = 4;

/** Chapters shown with their sentence. The rest keep a chip, so nothing is lost. */
const EXCERPTS = 3;

/* ------------------------------------------------------------------ *
 * Colour — one hue per check, mixed into theme tokens
 * ------------------------------------------------------------------ */

/**
 * **Mixed, never painted flat**, which is what makes one value work in both
 * themes with no second table: by day the tokens are white and near-white, so
 * 14% of a hue is a pastel; at night they are near-black, so the same 14% is a
 * deep tint. `tool-marks.tsx` does exactly this for its sixteen tiles, and it
 * is why this adds no seventh entry to the closed list of colour exceptions.
 *
 * These go through `style`, not a class. Tailwind v4 finds utilities by
 * scanning source for complete strings, and a hue only known at runtime is a
 * class nothing generates.
 */
const mix = (hue: string, percent: number, into: string) =>
  `color-mix(in srgb, ${hue} ${percent}%, var(${into}))`;

/**
 * The hue at a given strength, over whatever is behind it.
 *
 * **Used wherever a token would have been, because three of them are not what
 * they are at the top of the document.** Inside the editor's panel
 * `--color-surface`, `--color-raised` and `--color-line` are re-pointed to
 * translucent washes of `fg` — `#17171a0d` and friends — so that a panel layers
 * over whatever ground it is dropped onto. That is right for the panel and
 * quietly wrong for this card, which supplies its own ground: every box built
 * on `--color-surface` came out as a 5% black veil over the tint instead of the
 * white box the design is made of, and the same card looked correct on the full
 * screen and wrong in the rail.
 *
 * `--color-panel`, `--color-fg` and the status family are the same in both
 * places, so those are still read directly. Everything else is a translucent
 * hue, which needs no token at all.
 */
const tint = (hue: string, percent: number) =>
  `color-mix(in srgb, ${hue} ${percent}%, transparent)`;

/** The card itself: the most saturated thing in the finding. */
const cardGround = (hue: string) => mix(hue, 14, "--color-panel");
const cardEdge = (hue: string) => tint(hue, 45);

/**
 * The hue as ink: mixed against `fg`, which darkens it by day and lightens it at
 * night, so one number carries both. A flat hue would be a pale wash on white in
 * daylight and legible only at night.
 *
 * **Two of them, because the thresholds are two**, and both were measured rather
 * than guessed — in daylight, on the palest of the six hues, which is amber:
 *
 * - `hueDisplay` is the card's title. 24px bold is **large text**, so its bar is
 *   3:1; 72% gives amber 3.30:1 by day and 6.2:1 at night.
 * - `hueText` is everything else the hue writes — chapter links, chips, the
 *   lopsided line. Normal text, so the bar is 4.5:1, and 56% is what amber needs
 *   to reach it — 4.55:1. Sixty per cent is 4.17:1 and fails.
 *
 * **Set by the palest hue, not by each**, which is what keeps the six a family
 * rather than six separate decisions. One mix at 72% for *everything* was the
 * first attempt and it failed on amber, teal and emerald in daylight — amber
 * worst at 3.28:1 — while the same values were 5.4:1 and better at night, which
 * is exactly the half that gets looked at while a dark theme is being built.
 *
 * **The card's ground is not the lever it looks like.** Paling it from 14% to 8%
 * moves the title from 3.02:1 to only 3.16:1, because a 14% tint of a light hue
 * is already close to white; the ink percentage is what carries this. Change a
 * hue in `consistency-checks.ts` and these two numbers are what to re-measure.
 */
const hueDisplay = (hue: string) => mix(hue, 72, "--color-fg");
const hueText = (hue: string) => mix(hue, 56, "--color-fg");

/**
 * A box inside the card: the page's own ground, neutral.
 *
 * White on a pastel by day, which is the reference design exactly; at night the
 * card's tint is the lighter thing and these read as recesses cut into it,
 * which is the rule the whole night palette runs on. The hue stays on the card,
 * where it means *which check* — a second tint in here would be spending it
 * twice.
 */
const BOX = "var(--color-panel)";

/* ------------------------------------------------------------------ *
 * The card
 * ------------------------------------------------------------------ */

export function FindingCard({
  bookId,
  finding,
  quiet,
  onQuiet,
}: {
  bookId: string;
  finding: ConsistencyFinding;
  /** The writer has said the book is right and the check is wrong. */
  quiet: boolean;
  onQuiet: (key: string, next: boolean) => void;
}) {
  const look = CHECK_LOOK[finding.check];
  const hue = look.hue;

  /*
   * **The eyebrow is dropped when it would say the title twice.** A quotation
   * mark left open has no spellings, so its `label` *is* the check's name —
   * and that is the whole of what the two checks with no reference design
   * needed. They fall out of this rather than each needing one.
   */
  const eyebrow = finding.label === look.name ? null : look.name;

  const common = finding.variants[0];
  const rare = finding.variants[1];
  const lopsided =
    finding.variants.length === 2 && common.count >= rare.count * LOPSIDED;

  return (
    <li
      className={`@container overflow-hidden rounded-2xl border transition-opacity ${
        quiet ? "opacity-55" : ""
      }`}
      style={{ backgroundColor: cardGround(hue), borderColor: cardEdge(hue) }}
    >
      <div className="p-3.5 @sm:p-4 @lg:p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            {eyebrow && (
              /* **The page's own ink held back, not `text-muted`.** Muted is
                 the grey this app spends on metadata, and the check's name is
                 not metadata — it is the sentence that says what kind of thing
                 the card is, and on `unclosed` it is the whole title. At 11px
                 muted it read as a caption above the finding rather than as
                 part of it. */
              <p className="text-[12px] font-semibold text-fg/70 @sm:text-[13px]">
                {eyebrow}
              </p>
            )}
            <h3
              className="mt-1 text-[19px] leading-tight font-bold break-words @sm:text-[21px] @lg:text-[24px]"
              style={{ color: hueDisplay(hue) }}
            >
              {finding.label}
            </h3>
          </div>

          {/* **A switch, not a button, and it stays put.** This used to make
              the whole finding vanish into a `<details>` at the foot of the
              screen — an answer given by watching the thing you pressed
              disappear, with the way back somewhere else entirely. On, the card
              goes quiet where it stands and can be flipped straight back. */}
          <button
            type="button"
            role="switch"
            aria-checked={quiet}
            aria-label="Not a mistake"
            onClick={() => onQuiet(finding.key, !quiet)}
            className="flex shrink-0 items-center gap-2 rounded-full text-[11px] font-semibold text-muted outline-none transition-colors hover:text-fg focus-visible:ring-2 focus-visible:ring-accent/60"
          >
            <span className="hidden @xs:inline">Not a mistake</span>
            <SwitchTrack on={quiet} tint={hueDisplay(hue)} />
          </button>
        </div>

        {!quiet && (
          <>
            <div className="mt-3 space-y-2.5">
              {finding.variants.length === 0 ? (
                /* No spellings at all — a quotation mark left open is a place
                   in the book rather than a word spelled twice. */
                <Passages
                  bookId={bookId}
                  hue={hue}
                  mark={finding.passages?.[0]?.mark ?? finding.label}
                  count={finding.passages?.length ?? 0}
                  spots={finding.passages ?? []}
                />
              ) : lopsided ? (
                /* The odd one out leads. The data's order is commonest first,
                   which is the opposite of the order of the question — nobody
                   has ever wanted to visit the twenty-two correct uses. */
                <Spelling bookId={bookId} hue={hue} variant={rare} />
              ) : (
                finding.variants.map((variant) => (
                  <Spelling
                    key={variant.text}
                    bookId={bookId}
                    hue={hue}
                    variant={variant}
                  />
                ))
              )}
            </div>

            {lopsided && (
              /* The common spelling as context, not as a destination. No
                 chapters: there is nothing here anybody goes to look at. */
              <p className="mt-2.5 text-xs text-muted">
                <span className="font-semibold" style={{ color: hueText(hue) }}>
                  {common.text}
                </span>{" "}
                is used {plural(common.count, "time")} elsewhere.
              </p>
            )}

            <Disclosure>{finding.note}</Disclosure>
          </>
        )}
      </div>
    </li>
  );
}

/* ------------------------------------------------------------------ *
 * One spelling, and the chapters it is in
 * ------------------------------------------------------------------ */

function Spelling({
  bookId,
  hue,
  variant,
}: {
  bookId: string;
  hue: string;
  variant: Variant;
}) {
  const shown = variant.where.slice(0, EXCERPTS);
  const rest = variant.where.slice(EXCERPTS);

  return (
    <div className="overflow-hidden rounded-xl" style={{ backgroundColor: BOX }}>
      <div className="flex flex-wrap items-baseline gap-x-2.5 gap-y-1 px-3 pt-2.5 pb-2 @sm:px-3.5">
        <span
          className="rounded-md px-1.5 py-0.5 text-[15px] font-bold"
          style={{
            color: hueText(hue),
            backgroundColor: tint(hue, 18),
          }}
        >
          {variant.text}
        </span>
        <span className="text-[11px] font-semibold text-muted">
          {plural(variant.count, "time")} in the book
        </span>
      </div>

      {shown.map((where) => (
        <Excerpt
          key={where.chapterId}
          bookId={bookId}
          hue={hue}
          where={where}
          mark={variant.text}
          fallback={variant.example}
        />
      ))}

      {rest.length > 0 && (
        <div
          className="flex flex-wrap gap-1.5 px-3 pt-2 pb-2.5 @sm:px-3.5"
          style={{ borderTop: `1px solid ${tint(hue, 28)}` }}
        >
          {rest.map((where) => (
            <ChapterChip
              key={where.chapterId}
              bookId={bookId}
              hue={hue}
              where={where}
            />
          ))}
        </div>
      )}
    </div>
  );
}

/**
 * One chapter, and the writer's own line from it.
 *
 * `fallback` is the spelling's book-wide example, for a finding whose
 * per-chapter lines are not collectable — the whole row would otherwise be a
 * chapter name with nothing under it.
 */
function Excerpt({
  bookId,
  hue,
  where,
  mark,
  fallback,
}: {
  bookId: string;
  hue: string;
  where: Where;
  mark: string;
  fallback?: string;
}) {
  const sentence = where.example ?? fallback;
  return (
    <div
      className="px-3 py-2 @sm:px-3.5"
      style={{ borderTop: `1px solid ${tint(hue, 28)}` }}
    >
      <Link
        href={`/book/${bookId}/chapter/${where.chapterId}`}
        title={where.chapterTitle}
        className="text-[13px] font-bold hover:underline"
        style={{ color: hueText(hue) }}
      >
        {where.number === null ? where.chapterTitle : `Chapter ${where.number}`}
      </Link>
      {where.count > 1 && (
        <span className="ml-2 text-[11px] text-muted tabular-nums">
          ×{where.count}
        </span>
      )}
      {sentence && (
        <p className="mt-1 text-[13px] leading-relaxed text-fg/85">
          {marked(sentence, mark)}
        </p>
      )}
    </div>
  );
}

/**
 * The remaining chapters, small.
 *
 * Capped, because a chapter with no number falls back to its own title — and
 * "Chapter 5 – System Override" beside five chips reading "ch 4" makes the row
 * jump. The full name is on the tooltip either way.
 */
function ChapterChip({
  bookId,
  hue,
  where,
}: {
  bookId: string;
  hue: string;
  where: Where;
}) {
  return (
    <Link
      href={`/book/${bookId}/chapter/${where.chapterId}`}
      title={where.chapterTitle}
      className="max-w-[10rem] truncate rounded-full px-2 py-0.5 text-[11px] font-semibold transition-opacity hover:opacity-80"
      style={{
        color: hueText(hue),
        backgroundColor: tint(hue, 15),
      }}
    >
      {where.number === null ? where.chapterTitle : `ch ${where.number}`}
      <span className="ml-1 opacity-60">×{where.count}</span>
    </Link>
  );
}

/** A finding that points at places rather than at a spelling. */
function Passages({
  bookId,
  hue,
  mark,
  count,
  spots,
}: {
  bookId: string;
  hue: string;
  mark: string;
  count: number;
  spots: readonly Occurrence[];
}) {
  return (
    <div className="overflow-hidden rounded-xl" style={{ backgroundColor: BOX }}>
      <div className="flex flex-wrap items-baseline gap-x-2.5 gap-y-1 px-3 pt-2.5 pb-2 @sm:px-3.5">
        <span
          className="rounded-md px-1.5 py-0.5 text-[15px] font-bold"
          style={{
            color: hueText(hue),
            backgroundColor: tint(hue, 18),
          }}
        >
          {mark}
        </span>
        <span className="text-[11px] font-semibold text-muted">
          {plural(count, "place")} in the book
        </span>
      </div>
      {spots.map((spot, at) => (
        <div
          key={`${spot.chapterId}-${at}`}
          className="px-3 py-2 @sm:px-3.5"
          style={{ borderTop: `1px solid ${tint(hue, 28)}` }}
        >
          <Link
            href={`/book/${bookId}/chapter/${spot.chapterId}`}
            title={spot.chapterTitle}
            className="text-[13px] font-bold hover:underline"
            style={{ color: hueText(hue) }}
          >
            {spot.number === null ? spot.chapterTitle : `Chapter ${spot.number}`}
          </Link>
          <p className="mt-1 text-[13px] leading-relaxed text-fg/85">
            {marked(spot.text, spot.mark)}
          </p>
        </div>
      ))}
    </div>
  );
}

/**
 * Why anybody mentions this.
 *
 * Below the finding rather than above it, and closed: a paragraph above a list
 * is read once and then read past forever, while the same words underneath are
 * found by the person who went looking for them.
 */
function Disclosure({ children }: { children: React.ReactNode }) {
  return (
    <details className="group mt-2.5">
      <summary className="cursor-pointer list-none text-[11px] font-semibold text-muted hover:text-fg">
        <span className="group-open:hidden">Why this is here</span>
        <span className="hidden group-open:inline">Close</span>
      </summary>
      <p className="mt-1.5 max-w-2xl text-xs leading-relaxed text-muted">
        {children}
      </p>
    </details>
  );
}

/* ------------------------------------------------------------------ *
 * Marking the writer's own prose
 * ------------------------------------------------------------------ */

/**
 * The writer's own sentence, with what was found marked.
 *
 * **Returns nodes and never markup.** This text is the manuscript, and a
 * highlighter that builds an HTML string is one edit away from putting a
 * writer's own angle brackets through `dangerouslySetInnerHTML`. Same rule as
 * `markdown.ts` — the parser returns data.
 *
 * The `note` tokens rather than a literal yellow: amber on brown by day, deep
 * brown on gold at night. A highlighter-pen yellow was considered and would
 * have been the seventh thing in this app that does not follow the theme.
 *
 * **`note-line` is the ground, not `note-bg`**, and the difference is the whole
 * of whether this reads as a highlight. The status family is built to tint a
 * whole banner, so `note-bg` is #fffbeb by day — which on the white box these
 * sentences sit in is no ground at all, and the mark came out as a word in a
 * slightly different colour rather than a word struck through with a
 * highlighter. `note-line` is the hairline one step up, and the only member of
 * the trio dark enough to be a ground on white.
 *
 * **The ink is `fg`, not `note-fg`**, and that was measured rather than
 * assumed: amber ink on an amber ground came out at 4.03:1 in daylight, under
 * the 4.5:1 bar, on the one text on this card that is the writer's own
 * manuscript. The page's own ink clears 11.6:1 by day and 8.4:1 at night — and
 * it is what a highlighter actually is, which is the text unchanged with a
 * colour laid behind it. Colouring the words as well was the tell that this was
 * drawn as a badge rather than as a mark.
 */
export function marked(text: string, mark: string): React.ReactNode {
  const parts = mark.trim().split(/\s+/).filter(Boolean).map(escapeRe);
  if (parts.length === 0) return text;

  /*
   * **A word is a phrase; a punctuation mark is a set.**
   *
   * `a word typed twice` hands this "first first", which has to match those two
   * words *in that order* — an alternation would light up every "first" in the
   * chapter. The quotation check hands it `“ ”`, which is not a phrase at all
   * but the pair of marks the finding is about, and joining those with `\s+`
   * builds a pattern matching nothing: the curly excerpts came out with no
   * highlight in them whatsoever, on the one check whose entire subject is how
   * a mark prints.
   *
   * The leading character tells them apart, and it is the same test the
   * word-boundary branch already turns on.
   */
  const letters = /^\p{L}/u.test(mark);
  const pattern = letters
    ? parts.length === 1
      ? `\\b(${parts[0]})\\b`
      : `(${parts.join("\\s+")})`
    : `(${parts.join("|")})`;

  return text
    .split(new RegExp(pattern, "gi"))
    .map((part, at) =>
      at % 2 === 1 ? (
        <mark
          key={at}
          className="rounded-sm bg-note-line px-0.5 font-semibold text-fg"
        >
          {part}
        </mark>
      ) : (
        part
      ),
    );
}

const escapeRe = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
