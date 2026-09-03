/**
 * The one switch track, for a setting that is on or off.
 *
 * Extracted on the fourth copy rather than the first: the export wizard, the
 * cover dialog and `/book/new` each drew this shape privately, and the two
 * shelf copies carried notes saying the next screen to want one was the moment
 * to pull them together. The book panel's front- and back-matter rows are that
 * screen — sixteen of these on one card is not a place to discover that a
 * fourth hand-drawn track sits two pixels off the other three.
 *
 * **Presentational only.** It is `aria-hidden`, takes no handler and has no
 * focus of its own: the accessible control is the `<button type="button"
 * role="switch" aria-checked>` each call site wraps it in. That split is
 * deliberate — the wrapper is what differs between screens (a whole settings
 * row, a card, a list row that also opens a page), and folding it in here
 * would make the primitive guess at the layout around it.
 *
 * `bg-accent` with an `accent-ink` thumb, because the fill is white at night
 * and near-black by day; a fixed `bg-white` thumb is invisible in exactly one
 * theme, which is the half nobody tests.
 *
 * `className` carries the alignment rather than the primitive assuming it. The
 * three screens it came from all sit it against the first line of a two-line
 * label and pass `mt-0.5`; a single-line row wants it centred and passes
 * nothing.
 *
 * **`tint` is the one exception to the accent**, and it exists for the
 * consistency check's finding cards, where the switch sits inside a card that
 * already carries a hue of its own. The accent means *this is the way forward*
 * everywhere in this app, and "not a mistake" is the writer overruling a
 * finding rather than being led anywhere — an accent-blue track on a green
 * card reads as something borrowed from elsewhere on the screen. Pass a colour
 * and the on-track wears it; pass nothing and it is the accent, which is what
 * every other call site wants. **The thumb does not change**: `accent-ink` is
 * white by day and near-black at night, so it reads on any saturated track,
 * which is the whole reason the file comment above insists on it.
 */
export function SwitchTrack({
  on,
  tint,
  className = "",
}: {
  on: boolean;
  tint?: string;
  className?: string;
}) {
  return (
    <span
      aria-hidden="true"
      style={on && tint ? { backgroundColor: tint } : undefined}
      className={`flex h-5 w-9 shrink-0 items-center rounded-full p-0.5
                  transition-colors ${
                    on ? "bg-accent" : "bg-raised ring-1 ring-line ring-inset"
                  } ${className}`}
    >
      <span
        className={`h-4 w-4 rounded-full transition-transform ${
          on ? "translate-x-4 bg-accent-ink" : "bg-muted"
        }`}
      />
    </span>
  );
}
