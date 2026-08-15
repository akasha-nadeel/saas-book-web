/**
 * A mark for each of the fifteen tools.
 *
 * These replaced a set of uniform stroke icons — one weight, one colour, drawn
 * from the same grid — which read as *interface furniture* rather than as
 * fifteen things. Next to a grid like Zoho's integrations page, where every
 * entry is its own designed logo, ours looked like a toolbar.
 *
 * So each is built the way a product logo is: **solid shapes, two or three
 * colours, and a silhouette you could recognise with the label covered.** Two
 * rules keep the set from becoming a rabble — every mark is drawn on the same
 * 24 grid and sits on the same tile, and every one is filled geometry rather
 * than line work, so none of them looks like a different set's icon that
 * wandered in.
 *
 * **These keep their colour while the rest of the app is greyscale, and that is
 * deliberate.** A product mark is not chrome: it is the thing you learn to find
 * a tool by, the way you find an app on a phone without reading a single label.
 * Fifteen grey marks are fifteen grey squares. The tile they sit on belongs to
 * the app and is dark like everything else, so the colour is contained inside
 * the mark rather than loose on the page.
 *
 * **None of these is anybody's logo.** They are marks for our own features, so
 * there is nothing real to reproduce and nothing to get wrong: the place real
 * brand marks belong is `works-with.tsx` on the landing page, which carries
 * Microsoft's, Apple's and Amazon's with their sourcing and licences recorded.
 * Drawing a lookalike of somebody else's mark here would be the mistake that
 * file already warns about.
 *
 */

/**
 * The one colour each mark is *mostly* made of.
 *
 * **Beside the marks rather than beside the thing that uses them**, so that
 * changing a mark's fill and forgetting its hue is a one-file mistake rather
 * than a two-file one. Nothing here is decorative on its own: the landing
 * page's tool cloud tints each tile's ground, border and shadow from this, so
 * a wrong entry shows up as a tile whose plate does not match the logo on it.
 *
 * Where a mark carries two or three fills this is the *body* of the shape, not
 * the brightest part — `trend` and `send` both open on a pale highlight, and
 * taking the first fill in the file would have tinted their tiles from a
 * colour the eye reads as an accent rather than as the mark's own.
 */
export const TOOL_MARK_HUES: Record<string, string> = {
  package: "#2563eb",
  compass: "#059669",
  ruler: "#f59e0b",
  shelf: "#7c3aed",
  quote: "#8b5cf6",
  tag: "#0891b2",
  form: "#0d9488",
  image: "#f472b6",
  search: "#3b82f6",
  arc: "#10b981",
  lines: "#6366f1",
  trend: "#3b82f6",
  shield: "#0ea5e9",
  wallet: "#f59e0b",
  coins: "#047857",
  send: "#2563eb",
};

export const TOOL_MARKS: Record<string, React.ReactNode> = {
  // ---- Get it out ---------------------------------------------------------

  /** A box, seen from above and to the side — the thing you hand over. */
  package: (
    <>
      <path d="M3.5 7.4 12 2.6l8.5 4.8v9.2L12 21.4l-8.5-4.8Z" fill="#2563eb" />
      <path d="M3.5 7.4 12 12.2l8.5-4.8L12 2.6Z" fill="#60a5fa" />
      <path d="M12 12.2v9.2l8.5-4.8V7.4Z" fill="#1d4ed8" />
    </>
  ),

  /** A compass needle: the one that answers "which way now". */
  compass: (
    <>
      <circle cx="12" cy="12" r="9.5" fill="#059669" />
      <path d="M16.4 7.6 13.9 14 7.6 16.4 10 10Z" fill="#ffffff" />
      <path d="M16.4 7.6 13.9 14 12 12.1Z" fill="#a7f3d0" />
    </>
  ),

  /** A bound book with the ruler's measure on its page. */
  ruler: (
    <>
      <rect x="2.6" y="3" width="18.8" height="18" rx="3.4" fill="#f59e0b" />
      <rect x="2.6" y="3" width="4.4" height="18" rx="3.4" fill="#b45309" />
      <path
        d="M11 8.4h6.4M11 12h6.4M11 15.6h4"
        stroke="#ffffff"
        strokeWidth="1.7"
        strokeLinecap="round"
      />
    </>
  ),

  // ---- Find your shelf ----------------------------------------------------

  /** Three spines on a shelf — the books yours stands beside. */
  shelf: (
    <>
      <rect x="2.8" y="6" width="5" height="15" rx="1.4" fill="#7c3aed" />
      <rect x="9.4" y="3.4" width="5" height="17.6" rx="1.4" fill="#f59e0b" />
      <rect x="16" y="8.2" width="5.2" height="12.8" rx="1.4" fill="#10b981" />
    </>
  ),

  /** A quotation, which is all a blurb is. */
  quote: (
    <>
      <rect
        x="2.4"
        y="3.6"
        width="19.2"
        height="13.6"
        rx="3.6"
        fill="#8b5cf6"
      />
      <path d="M6.6 17.2h5.2l-5.2 4.2Z" fill="#8b5cf6" />
      <path
        d="M10.6 7.9c-2.2.5-3.5 2-3.5 3.9v2.3h3.7v-3.4H9c.1-.8.6-1.3 1.6-1.5Z"
        fill="#ffffff"
      />
      <path
        d="M17.6 7.9c-2.2.5-3.5 2-3.5 3.9v2.3h3.7v-3.4H16c.1-.8.6-1.3 1.6-1.5Z"
        fill="#ffffff"
      />
    </>
  ),

  /** The shelf label a shop files you under. */
  tag: (
    <>
      <path
        d="M12.6 2.6H20a1.4 1.4 0 0 1 1.4 1.4v7.4a2.2 2.2 0 0 1-.65 1.56l-7.8 7.8a2.2 2.2 0 0 1-3.1 0l-6.6-6.6a2.2 2.2 0 0 1 0-3.1l7.8-7.8a2.2 2.2 0 0 1 1.55-.66Z"
        fill="#0891b2"
      />
      <circle cx="16.9" cy="7.1" r="1.9" fill="#ffffff" />
    </>
  ),

  /**
   * A form with its fields filled — the details a shop asks for.
   *
   * Its own mark rather than the `tag` the categories tool carries. Two tools
   * wearing one glyph defeats the whole point of these being marks: they are
   * what a writer learns to find a tool by without reading, and a duplicate
   * sends them to the wrong screen and teaches them not to trust the icons.
   */
  form: (
    <>
      <rect
        x="3.8"
        y="2.6"
        width="16.4"
        height="18.8"
        rx="2.6"
        fill="#0d9488"
      />
      <rect
        x="6.8"
        y="6.4"
        width="10.4"
        height="1.9"
        rx="0.95"
        fill="#ffffff"
      />
      <rect
        x="6.8"
        y="10.2"
        width="10.4"
        height="1.9"
        rx="0.95"
        fill="#5eead4"
      />
      <rect x="6.8" y="14" width="6.2" height="1.9" rx="0.95" fill="#5eead4" />
    </>
  ),

  /** A picture, at the size a shop shows it. */
  image: (
    <>
      <rect x="2.4" y="4" width="19.2" height="16" rx="3.4" fill="#f472b6" />
      <circle cx="8.4" cy="9.6" r="2.1" fill="#fde68a" />
      <path
        d="M21.6 14.6V16.6a3.4 3.4 0 0 1-3.4 3.4H5.8a3.4 3.4 0 0 1-3.4-3.4v-.4l4.8-4.8 3.6 3.6 4.2-4.2Z"
        fill="#be185d"
      />
    </>
  ),

  /** A search, because that is where a title wins or loses. */
  search: (
    <>
      <path
        d="M15.6 15.6 20.8 20.8"
        stroke="#1d4ed8"
        strokeWidth="3.2"
        strokeLinecap="round"
      />
      <circle cx="10.4" cy="10.4" r="7.8" fill="#3b82f6" />
      <circle cx="10.4" cy="10.4" r="4.4" fill="#ffffff" />
    </>
  ),

  // ---- The writing --------------------------------------------------------

  /** The rise and fall a novel is shaped on, with its peak marked. */
  arc: (
    <>
      <path
        d="M1.8 20.4c2.8-9.6 6.2-14.4 10.2-14.4s7.4 4.8 10.2 14.4Z"
        fill="#10b981"
      />
      <circle cx="12" cy="5.4" r="3" fill="#f59e0b" />
    </>
  ),

  /** A page, counted rather than corrected. */
  lines: (
    <>
      <path
        d="M4.8 2.4h8.4L19.6 8.8V19a2.6 2.6 0 0 1-2.6 2.6H4.8A2.6 2.6 0 0 1 2.2 19V5A2.6 2.6 0 0 1 4.8 2.4Z"
        fill="#6366f1"
      />
      <path d="M13.2 2.4 19.6 8.8h-6.4Z" fill="#c7d2fe" />
      <path
        d="M6.4 12.4h8M6.4 15.6h8M6.4 18.8h5"
        stroke="#ffffff"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
    </>
  ),

  /** Three bars going up, which is the only question progress asks. */
  trend: (
    <>
      <rect x="2.6" y="12.6" width="5" height="8.8" rx="1.8" fill="#93c5fd" />
      <rect x="9.5" y="8" width="5" height="13.4" rx="1.8" fill="#3b82f6" />
      <rect x="16.4" y="3" width="5" height="18.4" rx="1.8" fill="#1d4ed8" />
    </>
  ),

  /** A shield, for the one tool that exists to defend you. */
  shield: (
    <>
      <path
        d="M12 2 3.8 5.1v6.6c0 5.1 3.4 9.2 8.2 10.7 4.8-1.5 8.2-5.6 8.2-10.7V5.1Z"
        fill="#0ea5e9"
      />
      <path
        d="m8.3 11.9 2.6 2.6 4.8-5.2"
        stroke="#ffffff"
        strokeWidth="2.1"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </>
  ),

  // ---- Money and reviews --------------------------------------------------

  /** A wallet, closed — the point being what to check before it opens. */
  wallet: (
    <>
      <rect
        x="2.4"
        y="4.8"
        width="19.2"
        height="14.4"
        rx="3.4"
        fill="#f59e0b"
      />
      <path d="M2.4 8.4h19.2v3H6.2a1.5 1.5 0 0 1 0-3Z" fill="#fcd34d" />
      <rect x="13.2" y="9.6" width="9.2" height="5" rx="2.5" fill="#b45309" />
      <circle cx="16.6" cy="12.1" r="1.4" fill="#ffffff" />
    </>
  ),

  /** A stack of coins: what it cost against what it earned. */
  coins: (
    <>
      <path d="M4 11.4v4c0 1.9 3.6 3.4 8 3.4s8-1.5 8-3.4v-4Z" fill="#047857" />
      <path
        d="M4 7.2v4.2c0 1.9 3.6 3.4 8 3.4s8-1.5 8-3.4V7.2Z"
        fill="#10b981"
      />
      <ellipse cx="12" cy="7.2" rx="8" ry="3.4" fill="#6ee7b7" />
    </>
  ),

  /** A paper plane. Advance copies go out and nothing comes back on its own. */
  send: (
    <>
      <path d="M22 2 2 9.6l8.2 3.2Z" fill="#60a5fa" />
      <path d="M22 2 10.2 12.8 13.4 21.4Z" fill="#2563eb" />
    </>
  ),
};

/**
 * One mark on its tile.
 *
 * One neutral tile for all fifteen rather than a tint of each mark's own
 * colour: a uniform tile is what makes a row of these read as a shelf of
 * products, and it is the one thing every logo grid worth copying has in
 * common. It is a lift off the card rather than the white it used to be,
 * because on this palette fifteen white tiles would be the brightest thing on
 * the screen — brighter than the marks they exist to hold. The border does the
 * lifting a shadow would, and stays crisp at this size.
 *
 * Drawn large. These are the only thing on a card now — the descriptions moved
 * to the hover — so the mark has to carry the recognition on its own, and a
 * 26px glyph on a grid this size reads as a bullet rather than a logo.
 */
export function ToolMark({ name }: { name: string }) {
  /*
   * **The tile is tinted from the mark, the way the landing page's is.**
   *
   * It was `bg-raised` with a `line` hairline — one neutral plate for all
   * sixteen, on the reasoning that a shadow does nothing on black so the lift
   * had to come from value. That is still true of the *lift*, and it is why
   * this is a value step rather than a drop shadow. What changed is that the
   * step is now taken in the mark's own hue, so a writer scanning the Tools
   * grid gets colour at tile size rather than only inside a 32px glyph.
   *
   * `color-mix` against the app's own `--color-raised` rather than white: this
   * grid is chrome and follows the theme, so mixing toward a literal would
   * have made sixteen pale plates that are correct in daylight and glowing
   * holes at night. Mixed against the token, the tint rides whatever `raised`
   * currently is and the percentages hold in both.
   *
   * Low percentages on purpose. The mark has to stay the most saturated thing
   * on its own tile — past about 20% the plate starts competing with the logo
   * it is holding, which is the failure the landing page's version documents.
   */
  const hue = TOOL_MARK_HUES[name] ?? "var(--color-accent)";
  return (
    <span
      className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl
                 border transition-colors group-hover:border-fg/25"
      style={{
        backgroundColor: `color-mix(in srgb, ${hue} 14%, var(--color-raised))`,
        borderColor: `color-mix(in srgb, ${hue} 32%, var(--color-line))`,
      }}
    >
      <svg viewBox="0 0 24 24" aria-hidden="true" className="h-8 w-8">
        {TOOL_MARKS[name]}
      </svg>
    </span>
  );
}
