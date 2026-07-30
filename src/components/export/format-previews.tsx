/**
 * A small picture of what each format actually produces.
 *
 * These exist to make the format cards do the thing the Vercel template cards
 * do — a preview tilted off the corner that straightens under the pointer — but
 * they had to earn their place first. A card that tilts a decoration on hover is
 * a trick; a card that tilts *the shape of the file you are about to get* is an
 * answer to the question the step is asking. So each one is drawn to the
 * characteristic look of its format: the PDF centres a chapter opening on a
 * trimmed page, the Word one is double-spaced under a manuscript header, the
 * Markdown one shows its own syntax.
 *
 * The text on them is the book's real title and first chapter, not a stand-in.
 * It costs nothing and it is the difference between a picture of a format and a
 * picture of *your book* in that format.
 *
 * Drawn from the app's own tokens rather than screenshotted, for the reason
 * landing-figures.tsx gives: a screenshot is an asset that goes stale silently
 * while the app keeps moving.
 *
 * Everything is a `<span>`. A button's content model is phrasing content, and
 * these live inside one — `<div>`s would be invalid markup that happens to
 * render.
 */

/**
 * The prose every preview is set in.
 *
 * The same two sentences the template preview on the Formatting step uses, so a
 * writer comparing the two is comparing the setting rather than the words. Real
 * sentences rather than lorem: the point of these is to show what a paragraph
 * looks like set in that format, and lorem's word lengths are Latin.
 */
export const OPENING =
  "The road ran west, and the salt began before she had counted a mile of it.";
export const SECOND =
  "She did not look back, and afterwards could never say whether that had been courage or the simple want of a reason to.";

/**
 * The measure every preview sets its text to.
 *
 * The sheet is as wide as the card, and the featured card is wide — left to
 * fill it, a line of 7px type runs eighty words across and stops looking like a
 * page. A book has a measure; so does this.
 */
const MEASURE = "max-w-[19rem]";

/** What a preview knows about the book it is standing in for. */
export interface PreviewBook {
  title: string;
  /** The first chapter's name, or a stand-in when the book has none yet. */
  chapter: string;
  /** For the manuscript header, which files under a surname. */
  author?: string;
}

interface PreviewProps {
  book: PreviewBook;
  /**
   * The sheet is as wide as the card rather than as wide as a page — true only
   * on the featured card. A preview that has something better to do with the
   * room says so; the rest ignore it and keep their measure.
   */
  wide?: boolean;
}

/** A trimmed page: chapter number, title, justified body — as `typeset.ts` sets it. */
function PdfPreview({ book }: PreviewProps) {
  return (
    <span className={`block h-full w-full ${MEASURE} px-6 pt-5 text-[#1a222d]`}>
      <span className="block text-center font-serif text-[8px] text-[#1a222d]/45">
        1
      </span>
      <span className="mt-1.5 block text-center font-serif text-[10px] tracking-[0.08em] text-[#1a222d]/80 uppercase">
        {book.chapter}
      </span>
      <span
        className="mt-3 block text-justify font-serif text-[7.5px] leading-[1.85] text-[#1a222d]/60"
        style={{ hyphens: "auto" }}
      >
        {OPENING} {SECOND}
      </span>
    </span>
  );
}

/**
 * A reader's page — or, on a wide sheet, a spread.
 *
 * The featured card's sheet is as wide as the card, and a single column of
 * book-measure prose stranded in the middle of it looks like a mistake rather
 * than a page: two thirds of the paper is blank. A book that wide *is* two
 * pages, so on a wide sheet it becomes a spread with a gutter, which fills the
 * width honestly and is more like the thing being described, not less.
 */
function EpubPreview({ book, wide }: PreviewProps) {
  const page = (folio: string, prose: string) => (
    <span className="flex min-w-0 flex-1 flex-col">
      <span className="flex items-baseline justify-between font-serif text-[6.5px] tracking-[0.1em] text-[#1a222d]/35 uppercase">
        <span className="truncate">{book.title}</span>
        <span className="shrink-0 pl-3">{folio}</span>
      </span>
      <span className="mt-3 block text-justify font-serif text-[7.5px] leading-[1.9] text-[#1a222d]/60">
        {prose}
      </span>
    </span>
  );

  return (
    <span
      className={`flex h-full w-full ${wide ? "" : MEASURE} flex-col px-6 pt-4 text-[#1a222d]`}
    >
      {/* The gutter is wider than the outer margins, as it is in a bound book. */}
      <span className="flex gap-10">
        {page("12", wide ? OPENING : `${OPENING} ${SECOND}`)}
        {wide && page("13", SECOND)}
      </span>

      <span className="mt-auto mb-3 flex items-center gap-2">
        <span className="block h-[3px] flex-1 rounded-full bg-[#1a222d]/10">
          <span className="block h-full w-1/3 rounded-full bg-[#1a222d]/35" />
        </span>
        <span className="shrink-0 font-sans text-[6px] text-[#1a222d]/40">
          32%
        </span>
      </span>
    </span>
  );
}

/** Standard manuscript: the header block, then double-spaced type. */
function WordPreview({ book }: PreviewProps) {
  const surname = (book.author ?? "").trim().split(/\s+/).pop() || "Author";
  return (
    <span className={`block h-full w-full ${MEASURE} px-6 pt-4 text-[#1a222d]`}>
      <span className="flex items-start justify-between font-mono text-[6.5px] leading-[1.6] text-[#1a222d]/45">
        <span className="block min-w-0">
          <span className="block truncate">{surname}</span>
          <span className="block truncate">{book.title.toUpperCase()}</span>
        </span>
        <span className="block shrink-0 pl-3">1</span>
      </span>
      <span className="mt-4 block truncate text-center font-mono text-[7px] tracking-wide text-[#1a222d]/70 uppercase">
        {book.chapter}
      </span>
      {/* Double-spaced, which is the whole point of the format. */}
      <span className="mt-3 block font-mono text-[7px] leading-[2.1] text-[#1a222d]/55">
        &nbsp;&nbsp;&nbsp;&nbsp;{OPENING}
      </span>
    </span>
  );
}

/** Plain text that shows its own syntax. */
function MarkdownPreview({ book }: PreviewProps) {
  return (
    <span
      className={`block h-full w-full ${MEASURE} px-6 pt-4 font-mono text-[7.5px] leading-[1.85] text-[#1a222d]/55`}
    >
      <span className="block truncate">
        <span className="text-[#2E9E5B]"># </span>
        {book.title}
      </span>
      <span className="mt-1 block truncate">
        <span className="text-[#2E9E5B]">## </span>
        {book.chapter}
      </span>
      <span className="mt-2 block">The road ran west, and the salt began</span>
      <span className="block">
        <span className="text-[#E5252A]">*before*</span> she had counted a mile
      </span>
      <span className="block">of it. She did not look back.</span>
      <span className="mt-2 block text-[#1a222d]/35">
        &gt; and afterwards could never say
      </span>
    </span>
  );
}

/** A player, a waveform, and the chapters it was cut into. */
function AudiobookPreview({ book }: PreviewProps) {
  // Fixed rather than random: a preview that redraws differently on every
  // render reads as a loading state.
  const bars = [
    30, 55, 40, 80, 65, 95, 50, 70, 35, 60, 85, 45, 75, 55, 90, 40, 65, 30, 50,
    70, 45, 80, 35, 60, 55, 38, 72, 48,
  ];
  return (
    <span
      className={`flex h-full w-full ${MEASURE} flex-col px-6 pt-4 text-[#1a222d]`}
    >
      <span className="flex items-center gap-2">
        <span className="flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-full bg-[#D97706]">
          <span
            className="block h-0 w-0"
            style={{
              borderTop: "3px solid transparent",
              borderBottom: "3px solid transparent",
              borderLeft: "5px solid white",
              marginLeft: "1px",
            }}
          />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate font-sans text-[7px] font-semibold text-[#1a222d]/70">
            {book.chapter}
          </span>
          <span className="block truncate font-sans text-[6px] text-[#1a222d]/40">
            {book.title}
          </span>
        </span>
        <span className="shrink-0 font-mono text-[6.5px] text-[#1a222d]/40">
          04:12 / 12:38
        </span>
      </span>

      <span className="mt-3 flex h-7 items-center gap-[3px]">
        {bars.map((h, i) => (
          <span
            key={i}
            className="block w-[3px] rounded-full"
            style={{
              height: `${h}%`,
              background: i < 10 ? "#D97706" : "rgba(26,34,45,0.15)",
              opacity: i < 10 ? 0.7 : 1,
            }}
          />
        ))}
      </span>

      <span className="mt-2.5 block font-mono text-[6.5px] leading-[1.9] text-[#1a222d]/40">
        <span className="flex justify-between">
          <span className="truncate">01 &nbsp;{book.chapter}</span>
          <span className="shrink-0 pl-2">12:38</span>
        </span>
        <span className="flex justify-between">
          <span className="truncate">02 &nbsp;Chapter Two</span>
          <span className="shrink-0 pl-2">09:41</span>
        </span>
      </span>
    </span>
  );
}

// ---------------------------------------------------------------------------
// The mark beside each format's name
// ---------------------------------------------------------------------------

/**
 * A file-type mark, in the colour that format is actually known by.
 *
 * **Not brand logos, and deliberately so.** Adobe and Microsoft have both had
 * their marks withdrawn from the open icon sets, so neither Acrobat's nor Word's
 * real logo can be shipped here — and putting them on these cards would be wrong
 * even if it could. A PDF from this app is made by the browser's print engine,
 * with no Adobe software involved anywhere; a DOCX is written by the `docx`
 * library, not by Word. PDF and DOCX are published standards, and these cards
 * are about the *format*, not about whose product opens it. A red Acrobat logo
 * would be claiming a relationship that does not exist.
 *
 * Markdown is the exception and gets its genuine mark, because Markdown's logo
 * is a real open one (CC0, by Dustin Curtis) and there is no company behind it
 * to misrepresent.
 *
 * Colours: PDF red and Word blue are the two the world already reads those
 * formats by — #2B579A is Word's own documented blue. EPUB green and audio amber
 * are ours; EPUB has no official mark in any open set and an MP3 of your own
 * book has no brand at all, so nothing here is dressed up as official.
 *
 * Paths: file glyphs from Font Awesome Free 6 (CC BY 4.0,
 * https://fontawesome.com); Markdown from Simple Icons (CC0).
 */
const BADGES: Record<
  keyof typeof PREVIEWS,
  { viewBox: string; path: string; color: string; label: string }
> = {
  pdf: {
    viewBox: "0 0 576 512",
    color: "#E5252A",
    label: "PDF file",
    path: "M96 0C60.7 0 32 28.7 32 64l0 384c0 35.3 28.7 64 64 64l80 0 0-112c0-35.3 28.7-64 64-64l176 0 0-165.5c0-17-6.7-33.3-18.7-45.3L290.7 18.7C278.7 6.7 262.5 0 245.5 0L96 0zM357.5 176L264 176c-13.3 0-24-10.7-24-24L240 58.5 357.5 176zM240 380c-11 0-20 9-20 20l0 128c0 11 9 20 20 20s20-9 20-20l0-28 12 0c33.1 0 60-26.9 60-60s-26.9-60-60-60l-32 0zm32 80l-12 0 0-40 12 0c11 0 20 9 20 20s-9 20-20 20zm96-80c-11 0-20 9-20 20l0 128c0 11 9 20 20 20l32 0c28.7 0 52-23.3 52-52l0-64c0-28.7-23.3-52-52-52l-32 0zm20 128l0-88 12 0c6.6 0 12 5.4 12 12l0 64c0 6.6-5.4 12-12 12l-12 0zm88-108l0 128c0 11 9 20 20 20s20-9 20-20l0-44 28 0c11 0 20-9 20-20s-9-20-20-20l-28 0 0-24 28 0c11 0 20-9 20-20s-9-20-20-20l-48 0c-11 0-20 9-20 20z",
  },
  docx: {
    viewBox: "0 0 384 512",
    color: "#2B579A",
    label: "Word file",
    path: "M0 64C0 28.7 28.7 0 64 0L213.5 0c17 0 33.3 6.7 45.3 18.7L365.3 125.3c12 12 18.7 28.3 18.7 45.3L384 448c0 35.3-28.7 64-64 64L64 512c-35.3 0-64-28.7-64-64L0 64zm208-5.5l0 93.5c0 13.3 10.7 24 24 24L325.5 176 208 58.5zM135.4 274.8c-2.9-12.9-15.7-21.1-28.6-18.2s-21.1 15.7-18.2 28.6l32 144c2.3 10.5 11.4 18.2 22.2 18.8s20.6-6.1 24-16.4l25.2-75.7 25.2 75.7c3.4 10.2 13.2 16.9 24 16.4s19.9-8.2 22.2-18.8l32-144c2.9-12.9-5.3-25.8-18.2-28.6s-25.8 5.3-28.6 18.2l-13.2 59.4-20.6-61.8c-3.3-9.8-12.4-16.4-22.8-16.4s-19.5 6.6-22.8 16.4l-20.6 61.8-13.2-59.4z",
  },
  epub: {
    viewBox: "0 0 512 512",
    color: "#2E9E5B",
    label: "EPUB file",
    path: "M256 141.3l0 309.3 .5-.2C311.1 427.7 369.7 416 428.8 416l19.2 0 0-320-19.2 0c-42.2 0-84.1 8.4-123.1 24.6-16.8 7-33.4 13.9-49.7 20.7zM230.9 61.5L256 72 281.1 61.5C327.9 42 378.1 32 428.8 32L464 32c26.5 0 48 21.5 48 48l0 352c0 26.5-21.5 48-48 48l-35.2 0c-50.7 0-100.9 10-147.7 29.5l-12.8 5.3c-7.9 3.3-16.7 3.3-24.6 0l-12.8-5.3C184.1 490 133.9 480 83.2 480L48 480c-26.5 0-48-21.5-48-48L0 80C0 53.5 21.5 32 48 32l35.2 0c50.7 0 100.9 10 147.7 29.5z",
  },
  markdown: {
    viewBox: "0 0 24 24",
    color: "#000000",
    label: "Markdown",
    path: "M22.27 19.385H1.73A1.73 1.73 0 010 17.655V6.345a1.73 1.73 0 011.73-1.73h20.54A1.73 1.73 0 0124 6.345v11.308a1.73 1.73 0 01-1.73 1.731zM5.769 15.923v-4.5l2.308 2.885 2.307-2.885v4.5h2.308V8.078h-2.308l-2.307 2.885-2.308-2.885H3.46v7.847zM21.232 12h-2.309V8.077h-2.307V12h-2.308l3.461 4.039z",
  },
  audiobook: {
    viewBox: "0 0 384 512",
    color: "#D97706",
    label: "Audio file",
    path: "M0 64C0 28.7 28.7 0 64 0L213.5 0c17 0 33.3 6.7 45.3 18.7L365.3 125.3c12 12 18.7 28.3 18.7 45.3L384 448c0 35.3-28.7 64-64 64L64 512c-35.3 0-64-28.7-64-64L0 64zm208-5.5l0 93.5c0 13.3 10.7 24 24 24L325.5 176 208 58.5zm53.8 185.2c-9.1-6.3-21.5-4.1-27.8 5s-4.1 21.5 5 27.8c23.9 16.7 39.4 44.3 39.4 75.5s-15.6 58.9-39.4 75.5c-9.1 6.3-11.3 18.8-5 27.8s18.8 11.3 27.8 5c34.1-23.8 56.6-63.5 56.6-108.3S296 267.5 261.8 243.7zM80 312c-8.8 0-16 7.2-16 16l0 48c0 8.8 7.2 16 16 16l24 0 27.2 34c3 3.8 7.6 6 12.5 6l.3 0c8.8 0 16-7.2 16-16l0-128c0-8.8-7.2-16-16-16l-.3 0c-4.9 0-9.5 2.2-12.5 6l-27.2 34-24 0zm128 72.2c0 10.7 10.5 18.2 18.9 11.6 12.9-10.3 21.1-26.1 21.1-43.8s-8.2-33.5-21.1-43.8c-8.4-6.7-18.9 .9-18.9 11.6l0 64.5z",
  },
};

/**
 * The mark itself, bare — no tile, no plate.
 *
 * It sits at the head of the card beside the format's name, which is where a
 * reader looks to find out what a thing is. On the artwork it was a second
 * object competing with the preview it was pinned to; here it is simply the
 * name's own mark, and each keeps its real colour.
 */
export function FormatMark({
  format,
  className = "h-[18px] w-[18px]",
}: {
  format: PreviewKey;
  className?: string;
}) {
  const badge = BADGES[format];
  return (
    <svg
      role="img"
      aria-label={badge.label}
      viewBox={badge.viewBox}
      fill={badge.color}
      className={`shrink-0 ${className}`}
    >
      <path d={badge.path} />
    </svg>
  );
}

const PREVIEWS = {
  pdf: PdfPreview,
  epub: EpubPreview,
  docx: WordPreview,
  markdown: MarkdownPreview,
  audiobook: AudiobookPreview,
} as const;

export type PreviewKey = keyof typeof PREVIEWS;

export function FormatPreview({
  format,
  book,
  wide,
}: {
  format: PreviewKey;
} & PreviewProps) {
  const Preview = PREVIEWS[format];
  return <Preview book={book} wide={wide} />;
}
