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
 * Laid out on a percentage grid with the connectors in an SVG behind it. The
 * tiles are positioned in the same coordinates the paths are drawn in, so the
 * lines meet the boxes at any size — `preserveAspectRatio="none"` lets the
 * viewBox stretch with the container, and `non-scaling-stroke` keeps the lines
 * an even weight while it does, which is what stops a stretched diagram from
 * having fat horizontals and thin verticals.
 *
 * Decorative: every word in it is repeated in the prose beside it, so it is
 * hidden from assistive technology rather than read out as a list of stray
 * file extensions.
 */

/** Coming in — see `parseFile` in src/lib/import/index.ts. */
const IN = ["DOCX", "EPUB", "MD", "TXT", "HTML", "Audio"];

/** Going out — see src/lib/export/index.ts. */
const OUT = ["EPUB", "DOCX", "PDF", "MD"];

/** Evenly spaced across the width, with a half step of margin at each end. */
function spread(count: number): number[] {
  const step = 100 / count;
  return Array.from({ length: count }, (_, i) => step * (i + 0.5));
}

const IN_X = spread(IN.length);
const OUT_X = spread(OUT.length);

const IN_Y = 9;
const OUT_Y = 91;
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
        className="absolute inset-0 h-full w-full text-line"
        style={{ vectorEffect: "non-scaling-stroke" }}
      >
        {/* Down out of each source, across to the middle, down into the hub.
            Orthogonal rather than curved: it reads as routing, which is what a
            file conversion is, rather than as something organic. */}
        {IN_X.map((x) => (
          <path
            key={x}
            vectorEffect="non-scaling-stroke"
            d={`M ${x} ${IN_Y + 9} V 30 H 50 V ${HUB_Y - 9}`}
          />
        ))}
        {OUT_X.map((x) => (
          <path
            key={x}
            vectorEffect="non-scaling-stroke"
            d={`M 50 ${HUB_Y + 9} V 70 H ${x} V ${OUT_Y - 9}`}
          />
        ))}
      </svg>

      {IN.map((label, i) => (
        <Tile key={label} label={label} x={IN_X[i]} y={IN_Y} />
      ))}

      {OUT.map((label, i) => (
        <Tile key={label} label={label} x={OUT_X[i]} y={OUT_Y} accent />
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
  x,
  y,
  accent,
}: {
  label: string;
  x: number;
  y: number;
  /** What comes out, marked apart from what goes in. */
  accent?: boolean;
}) {
  return (
    <span
      className={`absolute flex -translate-x-1/2 -translate-y-1/2 items-center
                  justify-center rounded-xl border bg-surface px-2 py-1.5
                  font-sans text-[0.625rem] font-semibold shadow-sm ${
                    accent
                      ? "border-accent/30 text-accent"
                      : "border-line text-muted"
                  }`}
      style={{ left: `${x}%`, top: `${y}%` }}
    >
      {label}
    </span>
  );
}
