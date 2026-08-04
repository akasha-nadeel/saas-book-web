/**
 * The one spinner, for a control that is busy.
 *
 * Extracted rather than written a third time: the checkout result already drew
 * this ring, and a second copy in a tool screen is how two loading states end
 * up spinning at different speeds and weights on one product.
 *
 * **A ring, not a logo.** `LoadingScreen` is the app announcing itself and is
 * right for a route that has not painted yet; this is a *button* saying it
 * heard you, and it has to be small enough to sit inside one without changing
 * its height.
 *
 * **A single arc, and the reason is a Tailwind trap.** The first draft held
 * the track at `border-current/25` with only the top edge solid. That utility
 * is silently dropped by Tailwind v4 — it is absent from the built CSS, which
 * is exactly the failure this project keeps warning about, and the spinner
 * would have shipped as a plain circle. Three transparent sides and one
 * current-coloured edge is supported, verified against the built stylesheet,
 * and reads better anyway: an arc plainly rotates, where a ring with a
 * slightly darker top can look like it is pulsing.
 *
 * `currentColor` on purpose, so it inherits whatever it is placed on — the
 * accent-ink of a filled button, the muted grey of a quiet one. A fixed colour
 * would be invisible in exactly one theme, which is the half nobody tests.
 */
export function Spinner({ className = "" }: { className?: string }) {
  return (
    <span
      aria-hidden="true"
      className={`inline-block shrink-0 animate-spin rounded-full border-2
                  border-transparent border-t-current ${className}`}
    />
  );
}
