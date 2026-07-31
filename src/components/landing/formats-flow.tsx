/**
 * What goes in, and what comes out.
 *
 * Six formats down into the app, and out the other side to the places the
 * finished file opens. Drawn as a flow because that is the actual shape of the
 * thing: a manuscript arrives from somewhere else and leaves for somewhere
 * else, and OpenChapter is the middle.
 *
 * The top row is the real dispatch table — `parseFile` in
 * `src/lib/import/index.ts` — so if a format is added or dropped, this picture
 * is wrong until it is edited. That is the right kind of wrong: a landing page
 * that quietly keeps promising a format the app no longer reads is worse.
 *
 * **On the marks.** Three of the formats above have a real, openly-licensed
 * logo and three do not, and the difference is what exists rather than what was
 * bothered with. Markdown publishes a mark into the public domain and HTML5 has
 * the W3C shield, both from Simple Icons (CC0); Microsoft's four squares come
 * from Font Awesome Free 6 (CC BY 4.0), the same source works-with.tsx uses
 * since Microsoft withdrew from the open sets. EPUB, TXT and audio have no mark
 * at all — they are file formats rather than brands — so those take a house
 * glyph, and the extension underneath identifies them. Trademarks belong to
 * their respective owners; this is nominative use.
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

import { DESTINATIONS, type Mark } from "./works-with";

type Format = {
  label: string;
  mark: "markdown" | "html" | "word" | "file" | "audio";
};

/** Coming in — see `parseFile` in src/lib/import/index.ts. */
const IN: Format[] = [
  { label: "DOCX", mark: "word" },
  { label: "EPUB", mark: "file" },
  { label: "MD", mark: "markdown" },
  { label: "TXT", mark: "file" },
  { label: "HTML", mark: "html" },
  { label: "Audio", mark: "audio" },
];

/**
 * Going out — where the files land, not the extensions again.
 *
 * EPUB, DOCX and Markdown appear in the row above as well, because those three
 * genuinely go both ways, and three tiles repeated under the hub read as a
 * mistake rather than as a round trip. Naming the destinations instead says
 * more and says it once: the row above is what you can hand *to* OpenChapter,
 * this one is what OpenChapter hands *on*.
 *
 * Every mark here is already sourced, coloured and licensed in works-with.tsx,
 * which is where the claim "your book opens here" is made in full. Picked by
 * name so a change there travels — and so a name that is dropped from that list
 * fails the build here rather than rendering an empty tile.
 */
const OUT_NAMES = [
  "Apple Books",
  "Kindle",
  "Google Play Books",
  "Obsidian",
] as const;

const OUT = OUT_NAMES.map((name) => {
  const found = DESTINATIONS.find((d) => d.name === name);
  if (!found) throw new Error(`No mark for ${name} in works-with.tsx`);
  return found;
});

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
        <Tile
          key={format.label}
          label={format.label}
          mark={format.mark}
          x={IN_X[i]}
          y={IN_Y}
        />
      ))}

      {OUT.map((destination, i) => (
        <Tile
          key={destination.name}
          label={destination.name}
          brand={destination.mark}
          x={OUT_X[i]}
          y={OUT_Y}
        />
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

function Tile({
  label,
  mark,
  brand,
  x,
  y,
}: {
  label: string;
  /** One of the format glyphs above. */
  mark?: Format["mark"];
  /** A sourced brand mark, for the destinations. */
  brand?: Mark;
  x: number;
  y: number;
}) {
  return (
    <span
      className="absolute flex w-[5.25rem] -translate-x-1/2 -translate-y-1/2
                 flex-col items-center gap-1.5 rounded-xl border border-line
                 bg-surface px-1.5 py-2.5 shadow-sm"
      style={{ left: `${x}%`, top: `${y}%` }}
    >
      {brand ? (
        <svg viewBox={brand.viewBox} className="h-6 w-6 shrink-0">
          {brand.paths.map((p) => (
            <path key={p.d} d={p.d} fill={p.fill} />
          ))}
        </svg>
      ) : (
        MARKS[mark!]
      )}
      <span className="text-center font-sans text-[0.6875rem] font-semibold text-muted">
        {label}
      </span>
    </span>
  );
}

/**
 * Three of these are the real thing, in their own published colours: the
 * Markdown mark and the HTML5 shield from Simple Icons (CC0), and Microsoft's
 * four squares from Font Awesome Free 6 (CC BY 4.0) — the same source and the
 * same paths works-with.tsx already uses, since Microsoft withdrew from the
 * open icon sets. Trademarks belong to their respective owners; this is
 * nominative use, naming the formats the app reads and writes.
 *
 * EPUB, PDF, TXT and audio have no mark to use. They are file formats rather
 * than brands: EPUB's belongs to the W3C and is not published as an icon, and
 * the one people picture for PDF is Adobe's, which is the mark works-with.tsx
 * already looked for and could not source. Drawing lookalikes would be
 * knock-offs of somebody's trademark, so those four take a house glyph — a
 * page for the three that are documents, a waveform for the one that is not —
 * and the extension underneath identifies them.
 */
const MARKS: Record<Format["mark"], React.ReactNode> = {
  markdown: (
    <svg viewBox="0 0 24 24" className="h-6 w-6" fill="#000000">
      <path d="M22.27 19.385H1.73A1.73 1.73 0 0 1 0 17.655V6.345a1.73 1.73 0 0 1 1.73-1.73h20.54A1.73 1.73 0 0 1 24 6.345v11.308a1.73 1.73 0 0 1-1.73 1.732zM5.769 15.923v-4.5l2.308 2.885 2.307-2.885v4.5h2.308V8.077h-2.308l-2.307 2.885-2.308-2.885H3.46v7.846zM21.232 12h-2.309V8.077h-2.307V12h-2.311l3.463 4.038z" />
    </svg>
  ),
  html: (
    <svg viewBox="0 0 24 24" className="h-6 w-6" fill="#E34F26">
      <path d="M1.5 0h21l-1.91 21.563L11.977 24l-8.564-2.438L1.5 0zm7.031 9.75l-.232-2.718 10.059.003.23-2.622L5.412 4.41l.698 8.01h9.126l-.326 3.426-2.91.804-2.955-.81-.188-2.11H6.248l.33 4.171L12 19.351l5.379-1.443.744-8.157H8.531z" />
    </svg>
  ),
  word: (
    <svg viewBox="0 0 448 512" className="h-5 w-5">
      <path d="M0 32l214.6 0 0 214.6-214.6 0 0-214.6z" fill="#F25022" />
      <path d="M233.4 32l214.6 0 0 214.6-214.6 0 0-214.6z" fill="#7FBA00" />
      <path d="M0 265.4l214.6 0 0 214.6-214.6 0 0-214.6z" fill="#00A4EF" />
      <path d="M233.4 265.4l214.6 0 0 214.6-214.6 0 0-214.6z" fill="#FFB900" />
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
      className="h-6 w-6 text-accent"
    >
      <path d="M11.4 2.4H6.2a1.6 1.6 0 0 0-1.6 1.6v12a1.6 1.6 0 0 0 1.6 1.6h7.6a1.6 1.6 0 0 0 1.6-1.6V6.4z" />
      <path d="M11.4 2.4v3.1a.9.9 0 0 0 .9.9h3.1" />
    </svg>
  ),
  audio: (
    <svg
      viewBox="0 0 20 20"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      className="h-6 w-6 text-accent"
    >
      <path d="M3 10v1M6.2 7v6.6M9.4 4.4v11.2M12.6 6.6v6.8M15.8 8.4v3.2M18.6 10v1" />
    </svg>
  ),
};
