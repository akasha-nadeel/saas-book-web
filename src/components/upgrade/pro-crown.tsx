/**
 * The marker on a *swatch* that belongs to Pro.
 *
 * **`ProBadge` is the marker everywhere else and this is not a second idea** —
 * it is the same statement where the badge does not fit. The badge is a word,
 * and a word needs a row: it wears the upgrade gradient beside the rail's
 * Paperback label and beside a locked consistency check, both of which are lines
 * of text with room to the right. A colour swatch is a 24px circle whose whole
 * job is to show a colour, and a 30px word laid over it hides the one thing the
 * writer is looking at.
 *
 * **So it sits on the corner rather than over the middle**, the way a count sits
 * on an app icon: over the top-right of the circle, overlapping its edge rather
 * than floating clear of it — hung fully outside the bounding box first, and it
 * read as a loose glyph beside the swatch instead of a mark *on* it. A first
 * attempt before that centred a lock disc on the swatch and had to be taken off
 * — it hid the colour it was marking, which is the one thing a palette may not
 * do. Between the two: touching the colour, covering almost none of it.
 *
 * **It carries no plan logic, for `ProBadge`'s reason.** Eight of these can
 * render at once in the paper and colour rows; a `usePlan()` inside would be
 * eight fetches for one answer. The caller has already decided.
 *
 * **Drawn here rather than downloaded.** The reference was a Flaticon crown,
 * whose free licence requires visible attribution wherever it appears — a line
 * of credit on the editor's paper panel for a 12px glyph. Redrawn on the shelf's
 * own grid it is a path in this file: no attribution, no binary in `public/`, no
 * network request, and it takes `currentColor`-style control like the rest of
 * the app's marks. The silhouette is the ordinary one — three points, deep
 * valleys, a band below the body — which is a shape nobody owns.
 *
 * **Gold, stated literally, and it is not a seventh palette exception.** The
 * documented list in `docs/styling.md` is closed and this adds nothing to
 * `@theme`: the value lives here, in the one component that draws it, the way
 * `LimitDialog`'s frame is a literal matched to its artwork. It has to be
 * literal — this is laid over an *arbitrary* colour, white paper through
 * near-black, and a token that inverts with the theme would vanish against one
 * end or the other.
 */
export function ProCrown({
  size = 13,
  className = "",
}: {
  /** The crown's width. 13 on a 24px swatch; larger on the phone's 44px. */
  size?: number;
  className?: string;
}) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 18"
      fill="#f8b133"
      /* `pointer-events-none`, or the press meant for the swatch lands on the
         crown and the offer never opens. */
      className={`pointer-events-none absolute -top-0.5 -right-0.5 ${className}`}
      style={{
        width: size,
        height: (size * 18) / 24,
        /* The reference is flat, with no outline, and it stays flat — but flat
           amber on a white sheet is about 1.7:1, and two of the six papers are
           white. A half-pixel shadow is the least that separates it from the
           swatch without drawing an edge the reference does not have. */
        filter: "drop-shadow(0 0 0.6px rgba(0, 0, 0, 0.5))",
      }}
    >
      {/* The body: three points over a base slightly narrower than the span of
          the tips, which is what stops it reading as a plain zigzag. */}
      <path d="M0.8 3 6.1 7.7 12 0.5 17.9 7.7 23.2 3 21.8 12.6 2.2 12.6Z" />
      {/* The band, detached. The gap is the whole of what makes it a crown
          rather than a jester's cap. */}
      <rect x="2.2" y="14.2" width="19.6" height="3.3" rx="0.4" />
    </svg>
  );
}
