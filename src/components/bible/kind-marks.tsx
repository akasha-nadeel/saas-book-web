/**
 * A mark per kind of bible entry — the artwork, and the tile it sits on.
 *
 * **Drawn the way `consistency/check-marks.tsx` draws its eleven**, and for the
 * same reason: seven shapes are something you recognise, where one shape in
 * seven colours is a legend you decode. Solid shapes on the 24 grid, two
 * strengths of one hue and the page behind it, the fills passed in rather than
 * baked — so a mark is a pastel plate by day, a deep one at night, and right
 * under every tint, with nothing added to the closed list of colour exceptions.
 *
 * **The hue lives on the mark and nowhere else.** The cards the marks sit on
 * are neutral: "colour that carries information moves to a glyph" is the rule
 * the panels were built to, and seven washed card grounds down one gallery
 * would be the pile of boxes that rule was written against.
 */

import { hueDisplay, mix, tint } from "@/components/consistency/check-hue";
import { kindOf, type EntryKind } from "@/lib/bible";

interface Ink {
  /** The shape that carries the idea. */
  strong: string;
  /** What supports it. */
  soft: string;
  /** A detail cut back out to the page. */
  page: string;
}

/** The same three steps `check-marks.tsx` measured: 13% tile, 52% support. */
const inkFor = (hue: string): Ink => ({
  strong: hueDisplay(hue),
  soft: mix(hue, 52, "--color-panel"),
  page: "var(--color-panel)",
});

const MARKS: Record<EntryKind, (ink: Ink) => React.ReactNode> = {
  /* Head and shoulders. */
  character: ({ strong, soft }) => (
    <>
      <path d="M4.5 21c0-4.4 3.4-7.5 7.5-7.5s7.5 3.1 7.5 7.5z" fill={soft} />
      <circle cx="12" cy="8" r="4" fill={strong} />
    </>
  ),
  /* A map pin over its shadow. */
  place: ({ strong, soft, page }) => (
    <>
      <ellipse cx="12" cy="21.2" rx="5" ry="1.3" fill={soft} />
      <path
        d="M12 2.5c-3.9 0-7 3-7 6.9 0 5.2 7 11.6 7 11.6s7-6.4 7-11.6c0-3.9-3.1-6.9-7-6.9z"
        fill={strong}
      />
      <circle cx="12" cy="9.4" r="2.6" fill={page} />
    </>
  ),
  /* A pennant on its pole — the thing a faction marches behind. */
  faction: ({ strong, soft }) => (
    <>
      <rect x="5" y="2.5" width="1.9" height="19" rx="0.95" fill={soft} />
      <path d="M7.6 3.8h11.9l-3.2 4.6 3.2 4.6H7.6z" fill={strong} />
    </>
  ),
  /* A star: something happened. Events carry no dates on purpose, so no calendar. */
  event: ({ strong, soft }) => (
    <>
      <circle cx="12" cy="12.6" r="8.2" fill={soft} />
      <path
        d="M12 5.2l2.1 4.3 4.7.7-3.4 3.3.8 4.7-4.2-2.2-4.2 2.2.8-4.7-3.4-3.3 4.7-.7z"
        fill={strong}
      />
    </>
  ),
  /* A key. */
  thing: ({ strong, soft, page }) => (
    <>
      <rect x="10.5" y="10.8" width="10.5" height="2.4" rx="1.2" fill={soft} />
      <rect x="15.6" y="12.2" width="2.1" height="4" rx="0.7" fill={soft} />
      <rect x="18.9" y="12.2" width="2.1" height="3" rx="0.7" fill={soft} />
      <circle cx="7.6" cy="12" r="4.6" fill={strong} />
      <circle cx="7.6" cy="12" r="1.9" fill={page} />
    </>
  ),
  /* An open book: what the world believes and remembers. */
  lore: ({ strong, soft }) => (
    <>
      <path d="M2.8 5.6c3.1-1 6.2-.6 8.5 1.1v13.2c-2.3-1.6-5.4-2-8.5-1z" fill={soft} />
      <path d="M21.2 5.6c-3.1-1-6.2-.6-8.5 1.1v13.2c2.3-1.6 5.4-2 8.5-1z" fill={strong} />
    </>
  ),
  /* A sheet with its corner folded. */
  note: ({ strong, soft, page }) => (
    <>
      <path
        d="M6 2.8h8.6l4.6 4.6V20.2a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V3.8a1 1 0 0 1 1-1z"
        fill={strong}
      />
      <path d="M14.6 2.8v4.6h4.6z" fill={soft} />
      <rect x="8" y="11" width="8" height="1.5" rx="0.75" fill={page} />
      <rect x="8" y="14.6" width="5.5" height="1.5" rx="0.75" fill={page} />
    </>
  ),
};

const TILE = {
  xs: { box: "h-7 w-7 rounded-lg", art: "h-4 w-4" },
  sm: { box: "h-8 w-8 rounded-[10px]", art: "h-[18px] w-[18px]" },
  md: { box: "h-11 w-11 rounded-xl", art: "h-6 w-6" },
} as const;

/**
 * The mark on its tile.
 *
 * **Mixed into `--color-panel`, never `--color-raised`**: inside the editor's
 * panel `raised` and `line` are translucent washes of `fg`, so a tile built on
 * them is a grey veil in the rail and right on a full page — the trap
 * `check-hue.ts` documents at `tint`. The edge is a translucent hue, which needs
 * no token at all.
 *
 * Three sizes for three homes: a row (`xs`), a card (`sm`), an entry's own page
 * (`md`).
 */
export function KindMark({
  kind,
  size = "sm",
}: {
  kind: EntryKind;
  size?: keyof typeof TILE;
}) {
  const { hue } = kindOf(kind);
  const tile = TILE[size];
  return (
    <span
      aria-hidden="true"
      className={`flex shrink-0 items-center justify-center border ${tile.box}`}
      style={{
        backgroundColor: mix(hue, 13, "--color-panel"),
        borderColor: tint(hue, 30),
      }}
    >
      <svg viewBox="0 0 24 24" className={tile.art}>
        {MARKS[kind](inkFor(hue))}
      </svg>
    </span>
  );
}

/** The kind as a dot, where a whole mark would crowd a chip. */
export function KindDot({ kind }: { kind: EntryKind }) {
  return (
    <span
      aria-hidden="true"
      className="h-2 w-2 shrink-0 rounded-full"
      style={{ backgroundColor: hueDisplay(kindOf(kind).hue) }}
    />
  );
}
