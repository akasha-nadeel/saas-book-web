/**
 * What goes in, and what comes out.
 *
 * Six formats down into the app and four back out of it, drawn as a flow
 * because that is the actual shape of the thing: a manuscript arrives from
 * somewhere else and leaves for somewhere else, and OpenChapter is the middle.
 * A list of twelve file extensions says the same words and none of the same
 * thing.
 *
 * Both rows are the real dispatch tables — `src/lib/import/index.ts` and
 * `src/lib/export/` — so if a format is added or dropped, this picture is
 * wrong until it is edited. That is the right kind of wrong: a landing page
 * that quietly keeps promising a format the app no longer reads is worse.
 *
 * **On the marks.** Two of these formats have a real, openly-licensed logo and
 * five do not, and the difference is not laziness — it is what exists. Markdown
 * publishes a mark into the public domain and HTML5 has the W3C shield, both
 * carried by Simple Icons (CC0), so those two are the genuine article in their
 * own colours. DOCX, EPUB, PDF, TXT and audio have no such thing: they are file
 * formats rather than brands, and the marks people picture for them belong to
 * Microsoft and Adobe, whose artwork is not in the open sets — the same finding
 * that dropped Acrobat from the marquee in works-with.tsx. Drawing a lookalike
 * would be a knock-off of somebody's trademark, so those five take the house
 * glyph instead, and the extension underneath is what identifies them.
 *
 * Laid out on a percentage grid with the connectors in an SVG behind it. The
 * tiles are positioned in the same coordinates the paths are drawn in, so the
 * lines meet the boxes at any size — `preserveAspectRatio="none"` lets the
 * viewBox stretch with the container, and `non-scaling-stroke` keeps the lines
 * an even weight while it does, which is what stops a stretched diagram from
 * having fat horizontals and thin verticals.
 *
 * Decorative: every format in it is named in the prose beside it, so it is
 * hidden from assistive technology rather than read out as a list of stray
 * file extensions.
 */

type Format = { label: string; mark: "markdown" | "html" | "file" };

/** Coming in — see `parseFile` in src/lib/import/index.ts. */
const IN: Format[] = [
  { label: "DOCX", mark: "file" },
  { label: "EPUB", mark: "file" },
  { label: "MD", mark: "markdown" },
  { label: "TXT", mark: "file" },
  { label: "HTML", mark: "html" },
  { label: "Audio", mark: "file" },
];

/** Going out — see src/lib/export/index.ts. */
const OUT: Format[] = [
  { label: "EPUB", mark: "file" },
  { label: "DOCX", mark: "file" },
  { label: "PDF", mark: "file" },
  { label: "MD", mark: "markdown" },
];

/** Evenly spaced across the width, with a half step of margin at each end. */
function spread(count: number): number[] {
  const step = 100 / count;
  return Array.from({ length: count }, (_, i) => step * (i + 0.5));
}

const IN_X = spread(IN.length);
const OUT_X = spread(OUT.length);

const IN_Y = 11;
const OUT_Y = 89;
const HUB_Y = 50;

export function FormatsFlow() {
  return (
    <div
      aria-hidden="true"
      className="relative aspect-[5/4] w-full max-w-lg select-none sm:aspect-[3/2]"
    >
      <svg
        viewBox="0 0 100 100"
        preserveAspectRatio="none"
        fill="none"
        stroke="currentColor"
        strokeWidth="1"
        strokeLinejoin="round"
        strokeLinecap="round"
        // Not `text-line`. That token is drawn to separate white from white,
        // and on this section's tinted ground it disappears — the diagram
        // rendered as tiles floating with nothing joining them, which is the
        // one thing the picture exists to show.
        className="absolute inset-0 h-full w-full text-accent/30"
      >
        {/* Down out of each source, across to the middle, down into the hub.
            Orthogonal rather than curved: it reads as routing, which is what a
            file conversion is, rather than as something organic. */}
        {IN_X.map((x) => (
          <path
            key={x}
            vectorEffect="non-scaling-stroke"
            d={`M ${x} ${IN_Y + 11} V 31 H 50 V ${HUB_Y - 9}`}
          />
        ))}
        {OUT_X.map((x) => (
          <path
            key={x}
            vectorEffect="non-scaling-stroke"
            d={`M 50 ${HUB_Y + 9} V 69 H ${x} V ${OUT_Y - 11}`}
          />
        ))}
      </svg>

      {IN.map((format, i) => (
        <Tile key={format.label} format={format} x={IN_X[i]} y={IN_Y} />
      ))}

      {OUT.map((format, i) => (
        <Tile key={format.label} format={format} x={OUT_X[i]} y={OUT_Y} />
      ))}

      {/* The hub. The only filled thing in the picture, because it is the only
          thing in the picture that is the product. */}
      <span
        className="absolute flex h-12 w-12 -translate-x-1/2 -translate-y-1/2
                   items-center justify-center rounded-2xl bg-accent shadow-lg"
        style={{ left: "50%", top: `${HUB_Y}%` }}
      >
        <span
          className="h-6 w-6 bg-white"
          style={{
            maskImage: "url(/logo.png)",
            WebkitMaskImage: "url(/logo.png)",
            maskSize: "contain",
            WebkitMaskSize: "contain",
            maskRepeat: "no-repeat",
            WebkitMaskRepeat: "no-repeat",
            maskPosition: "center",
            WebkitMaskPosition: "center",
          }}
        />
      </span>
    </div>
  );
}

function Tile({ format, x, y }: { format: Format; x: number; y: number }) {
  return (
    <span
      className="absolute flex w-[4.25rem] -translate-x-1/2 -translate-y-1/2
                 flex-col items-center gap-1 rounded-xl border border-line
                 bg-surface px-1.5 py-2 shadow-sm"
      style={{ left: `${x}%`, top: `${y}%` }}
    >
      {MARKS[format.mark]}
      <span className="font-sans text-[0.625rem] font-semibold text-muted">
        {format.label}
      </span>
    </span>
  );
}

/**
 * Markdown and HTML5 are the real marks, from Simple Icons (CC0), in their own
 * published colours. Trademarks belong to their respective owners; this is
 * nominative use — naming the formats the app reads and writes.
 *
 * `file` is ours, for the five formats that have no mark to use.
 */
const MARKS: Record<Format["mark"], React.ReactNode> = {
  markdown: (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="#000000">
      <path d="M22.27 19.385H1.73A1.73 1.73 0 0 1 0 17.655V6.345a1.73 1.73 0 0 1 1.73-1.73h20.54A1.73 1.73 0 0 1 24 6.345v11.308a1.73 1.73 0 0 1-1.73 1.732zM5.769 15.923v-4.5l2.308 2.885 2.307-2.885v4.5h2.308V8.077h-2.308l-2.307 2.885-2.308-2.885H3.46v7.846zM21.232 12h-2.309V8.077h-2.307V12h-2.311l3.463 4.038z" />
    </svg>
  ),
  html: (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="#E34F26">
      <path d="M1.5 0h21l-1.91 21.563L11.977 24l-8.564-2.438L1.5 0zm7.031 9.75l-.232-2.718 10.059.003.23-2.622L5.412 4.41l.698 8.01h9.126l-.326 3.426-2.91.804-2.955-.81-.188-2.11H6.248l.33 4.171L12 19.351l5.379-1.443.744-8.157H8.531z" />
    </svg>
  ),
  file: (
    <svg
      viewBox="0 0 20 20"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="h-4 w-4 text-accent"
    >
      <path d="M11.4 2.4H6.2a1.6 1.6 0 0 0-1.6 1.6v12a1.6 1.6 0 0 0 1.6 1.6h7.6a1.6 1.6 0 0 0 1.6-1.6V6.4z" />
      <path d="M11.4 2.4v3.1a.9.9 0 0 0 .9.9h3.1" />
    </svg>
  ),
};
