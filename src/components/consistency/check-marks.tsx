/**
 * A mark per consistency check — the artwork, and the tile it sits on.
 *
 * **This reverses what `check-picker.tsx` used to say**, and the old note is
 * worth keeping in view:
 *
 * > A magnifier over a line of text: what every one of these does is read the
 * > book looking for one thing. One mark for all eleven and not eleven
 * > metaphors — the hue is what tells them apart.
 *
 * That is a coherent design and it asks the writer to hold a legend in their
 * head: eleven identical shapes, and the colour is the only thing carrying
 * *which check*. It works on the picker, where the name is beside the tile, and
 * it stops working the moment the same tile has to lead a row in a result the
 * writer is scanning. **Eleven shapes is something you recognise; one shape in
 * eleven colours is something you decode.**
 *
 * **Drawn like `tool-marks.tsx`, coloured unlike it.** The house rule for the
 * sixteen tool marks holds here — solid shapes, two or three colours, a
 * silhouette you could recognise with the label covered, everything on the same
 * 24 grid. What is *not* copied is the literal hexes those bake into the
 * artwork: that set is one of the closed-list colour exceptions, and eleven more
 * of them would be a twelfth. These take their fills as arguments, mixed from
 * the check's existing `CHECK_LOOK[id].hue` into theme tokens, so they add no
 * entry to the list and follow every theme and tint for free.
 *
 * **Four are letterforms, and that is not a cop-out.** A curly quotation mark, a
 * straight one, `Aa` and `12` are the *subject* of their checks, not a metaphor
 * for it — drawing a picture of a quotation mark instead of a quotation mark
 * would be the worse choice. The other seven are geometry.
 */

import { hueDisplay, mix, tint } from "@/components/consistency/check-hue";
import { CHECK_LOOK } from "@/lib/consistency-checks";
import type { CheckId } from "@/lib/consistency-ids";

/**
 * The three fills a mark may use.
 *
 * Two strengths of one hue and the page behind it — the same three-value palette
 * `tool-marks.tsx` gives each of its sixteen, with the values mixed rather than
 * literal. `strong` is the `hueDisplay` mix, whose 3:1 daylight measurement was
 * taken for large text and is the right bar for artwork.
 */
interface Ink {
  /** The shape that carries the idea. */
  strong: string;
  /** What supports it — a ground, a second copy, the thing being compared. */
  soft: string;
  /** A detail cut back out to the page, as `shield` uses white. */
  page: string;
}

/**
 * **The gap between `soft` and the tile is what makes a mark readable**, and it
 * was measured on screen rather than guessed. At 34% over a 16% tile the
 * supporting shapes all but vanished: `doubled` read as one bar rather than
 * two, and `hyphens` lost the blocks its hyphen is meant to join — which is the
 * whole silhouette. 52% over a 13% tile gives three clear steps.
 */
const inkFor = (hue: string): Ink => ({
  strong: hueDisplay(hue),
  soft: mix(hue, 52, "--color-panel"),
  page: "var(--color-panel)",
});

/** A letterform drawn as artwork rather than as prose. */
function Glyph({
  children,
  fill,
  x,
  y,
  size,
  serif = false,
}: {
  children: string;
  fill: string;
  x: number;
  y: number;
  size: number;
  serif?: boolean;
}) {
  return (
    <text
      x={x}
      y={y}
      textAnchor="middle"
      fontSize={size}
      fontWeight={700}
      fill={fill}
      /* Stated rather than inherited. These are shapes, and a mark that changes
         shape with the writer's manuscript font is not a mark. Serif for the
         quotation marks, whose curl is the whole point of the glyph. */
      fontFamily={
        serif
          ? "Georgia, 'Times New Roman', serif"
          : "ui-sans-serif, system-ui, sans-serif"
      }
    >
      {children}
    </text>
  );
}

/**
 * The artwork, on a 24 grid, keyed by check.
 *
 * `Record<CheckId, …>` for the reason `CHECK_LOOK` is one: a check added to the
 * engine and forgotten here is a **compile error**, not a tile that silently
 * never draws.
 */
export const CHECK_MARKS: Record<CheckId, (ink: Ink) => React.ReactNode> = {
  /** Two name tags, the same name on both — offset, because they disagree. */
  names: ({ strong, soft, page }) => (
    <>
      <rect x="2" y="4" width="14.5" height="7" rx="2.4" fill={soft} />
      <rect x="7.5" y="13" width="14.5" height="7" rx="2.4" fill={strong} />
      <rect x="4.6" y="6.9" width="9.3" height="1.7" rx=".85" fill={page} />
      <rect x="10.1" y="15.9" width="9.3" height="1.7" rx=".85" fill={page} />
    </>
  ),

  /** A globe: one language, two countries. */
  spelling: ({ strong, soft }) => (
    <>
      <circle cx="12" cy="12" r="9.2" fill={soft} />
      <rect x="2.8" y="10.9" width="18.4" height="2.2" rx="1.1" fill={strong} />
      <ellipse
        cx="12"
        cy="12"
        rx="4.2"
        ry="9.2"
        fill="none"
        stroke={strong}
        strokeWidth="2"
      />
    </>
  ),

  /** One word, written two lengths. Neither is a mistake, which is the check. */
  style: ({ strong, soft }) => (
    <>
      <rect x="2.5" y="5" width="13.5" height="4.8" rx="2.4" fill={soft} />
      <rect x="8" y="14.2" width="13.5" height="4.8" rx="2.4" fill={strong} />
    </>
  ),

  /** The magnifier stays here, on the one check that really is a near search. */
  typos: ({ strong, soft, page }) => (
    <>
      <path
        d="M15.7 15.7 20.6 20.6"
        stroke={strong}
        strokeWidth="3.2"
        strokeLinecap="round"
      />
      <circle cx="10.4" cy="10.4" r="7.7" fill={soft} />
      <circle cx="10.4" cy="10.4" r="4.2" fill={page} />
    </>
  ),

  /** The marks themselves: one pair typographic, one pair straight. */
  quotes: ({ strong, soft }) => (
    <>
      <Glyph x={8} y={17} size={19} fill={strong} serif>
        &ldquo;
      </Glyph>
      <Glyph x={17} y={17} size={17} fill={soft}>
        &quot;
      </Glyph>
    </>
  ),

  /** An opening mark, and the empty place its closer never arrived in. */
  unclosed: ({ strong, soft }) => (
    <>
      <Glyph x={7.5} y={17} size={19} fill={strong} serif>
        &ldquo;
      </Glyph>
      <rect
        x="13.4"
        y="7.6"
        width="7.4"
        height="8.8"
        rx="2.2"
        fill="none"
        stroke={soft}
        strokeWidth="1.9"
        strokeDasharray="2.6 2.4"
      />
    </>
  ),

  /** The same shape, twice, side by side. */
  doubled: ({ strong, soft }) => (
    <>
      <rect x="2.2" y="9.4" width="9" height="5.2" rx="2.6" fill={soft} />
      <rect x="12.8" y="9.4" width="9" height="5.2" rx="2.6" fill={strong} />
    </>
  ),

  /** Two halves of a compound, and the mark that does or does not join them. */
  hyphens: ({ strong, soft }) => (
    <>
      <rect x="1.8" y="9.4" width="7.6" height="5.2" rx="2.6" fill={soft} />
      <rect x="14.6" y="9.4" width="7.6" height="5.2" rx="2.6" fill={soft} />
      <rect x="10.3" y="10.9" width="3.4" height="2.2" rx="1.1" fill={strong} />
    </>
  ),

  /** Digits above the word that says the same number. */
  numbers: ({ strong, soft }) => (
    <>
      <Glyph x={12} y={12.4} size={12} fill={strong}>
        12
      </Glyph>
      <rect x="4.6" y="15.4" width="14.8" height="4.2" rx="2.1" fill={soft} />
    </>
  ),

  /** One letter, both ways. */
  capitals: ({ strong, soft }) => (
    <>
      <Glyph x={8} y={18} size={16} fill={strong}>
        A
      </Glyph>
      <Glyph x={17} y={18} size={14} fill={soft}>
        a
      </Glyph>
    </>
  ),

  /** A gap between two runs of prose, marked in the middle. */
  breaks: ({ strong, soft }) => (
    <>
      <rect x="2.6" y="4.6" width="18.8" height="2.2" rx="1.1" fill={soft} />
      <rect x="2.6" y="17.2" width="18.8" height="2.2" rx="1.1" fill={soft} />
      <circle cx="8" cy="12" r="1.7" fill={strong} />
      <circle cx="12" cy="12" r="1.7" fill={strong} />
      <circle cx="16" cy="12" r="1.7" fill={strong} />
    </>
  ),
};

/**
 * The mark on its tile.
 *
 * **Mixed into `--color-panel`, not `--color-raised`**, which is where this
 * parts company with `ToolMark`. Inside the editor's panel `raised` and `line`
 * are re-pointed to translucent washes of `fg`, so a tile built on them comes
 * out as a grey veil in the rail and correct on the full page — the trap
 * `check-hue.ts` documents at `tint`. `panel` is the same in both places, and
 * the border is a translucent hue, which needs no token at all.
 *
 * Two sizes, because there are two homes: the picker's card and the row in a
 * result. `sm` is the 36px the picker already reserved, so no card reflows.
 */
export function CheckMark({
  id,
  size = "sm",
}: {
  id: CheckId;
  size?: "sm" | "md";
}) {
  const hue = CHECK_LOOK[id].hue;
  const ink = inkFor(hue);

  return (
    <span
      aria-hidden="true"
      className={`flex shrink-0 items-center justify-center rounded-xl border ${
        size === "md" ? "h-10 w-10" : "h-9 w-9"
      }`}
      style={{
        backgroundColor: mix(hue, 13, "--color-panel"),
        borderColor: tint(hue, 30),
      }}
    >
      <svg
        viewBox="0 0 24 24"
        className={size === "md" ? "h-[22px] w-[22px]" : "h-5 w-5"}
      >
        {CHECK_MARKS[id](ink)}
      </svg>
    </span>
  );
}
