import { Spinner } from "@/components/ui/spinner";

/**
 * What a screen shows while it has nothing to show yet.
 *
 * **It was a logo, and the logo has gone.** The mark filled from its foot over
 * a dim copy with the word "Loading…" under it, the way Overleaf fills its
 * leaf — and it was paired with `AppLoader`, which *held* it on screen for a
 * second on every route so the animation had time to play. Both are gone at
 * the owner's request, and the held second is the part worth not rebuilding:
 * a splash that waits for its own animation is a delay the product invented,
 * paid by a writer who asked for a page.
 *
 * What is left is the app's own `Spinner`, centred. One loading idiom for the
 * whole product — the same ring a busy button draws — so a screen waiting and
 * a control waiting no longer look like two different systems.
 *
 * **No text.** "Loading…" under a spinner is the spinner in words; the ring
 * already says it, and `role="status"` with an accessible name says it to a
 * screen reader without putting a second copy on the glass.
 *
 * Still a server component with no JavaScript of its own, so it can render
 * inside a Suspense fallback or during hydration exactly as before.
 */
export function LoadingScreen() {
  return (
    <div
      role="status"
      aria-label="Loading"
      className="flex h-dvh w-full items-center justify-center bg-surface"
    >
      {/* `text-muted` rather than the accent: this is furniture a reader is
          waiting behind, not something to look at. The spinner takes its
          colour from whatever it sits on. */}
      <Spinner className="h-7 w-7 text-muted" />
    </div>
  );
}
