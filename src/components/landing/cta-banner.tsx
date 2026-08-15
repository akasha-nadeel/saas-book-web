import Link from "next/link";
import { ToolMarquee } from "@/components/landing/tool-marquee";
import { SECTION_TITLE } from "@/components/landing/type";

/**
 * The closing banner — the last ask, and the top half of the one section that
 * ends the page.
 *
 * **It is no longer a section of its own.** It used to be an indigo sky
 * holding the sentence on the left and a drawn app window on the right,
 * oversized and cropped by the bottom edge, with the gradient landing on the
 * footer's ground so the two read as one movement. That worked, and it was
 * *two* pictures at the end of a page — a lit gradient, then a landscape band
 * inside the footer under it. Now there is one photograph, the ask sits on its
 * sky, and the footer rides up onto its foot as a card. The reference does
 * exactly this and it is the reason the arrangement holds together: a reader
 * meets one closing image rather than a banner, a rule, and a second image.
 *
 * **What the picture cost, and it is worth stating plainly.** The drawn window
 * went with it. There is no room for a 54rem figure on a landscape without
 * covering the landscape, and the reference's own closing banner carries no
 * product shot for the same reason. Nothing it said is lost: the tool count is
 * counted from `ALL_TOOLS` in the tools heading, the zero EPUBCheck errors is
 * the subject of its own section, and the dashboard itself is drawn twice
 * higher up the page in `check-demo.tsx`. A third drawing of it here was the
 * least load-bearing thing on the page.
 *
 * **The ask sits on the page's ground and the picture starts under it**, which
 * is the reference's arrangement and, here, a measured necessity rather than a
 * copy. Centring the words on the sky was tried with two different landscapes.
 * It photographs beautifully at 1280 and comes apart everywhere else: the ask
 * is a fixed stack of pixels while the frame scales with the width, so the
 * share of the picture it covers grows as the window narrows, and probing four
 * widths in an iframe put the caveat line at 41% of the frame at 1280 and
 * **58% at 390** — out past the ridge, over open water measuring 2.2:1. The
 * full working is in `globals.css` beside `.oc-closing`. On the page's own
 * white every line is safe at every width, and this picture's sky is pale
 * enough that the join needs nothing but a short veil.
 *
 * **The picture itself is not drawn here.** This section ends on white; the
 * landscape is the *footer's* own background, so it can run behind the whole
 * of it and show down both edges to the last line of small print. It lived
 * here as a fixed-height band once and that is exactly what it could not do.
 *
 * **The two buttons stay filled even so.** They are the last thing before the
 * artwork and the pair a reader's eye travels to, and a bordered ghost button
 * is a shape that only works on a plain ground — it was one layout change away
 * from sitting on the water. Two fills cost nothing and cannot be undone by
 * moving them.
 *
 * The caveats sit on one line *above* the buttons rather than inside them. The
 * old badge shape carried a quiet line over a loud one, which let a button
 * state its own catch; a filled pill has no room for that, so the catch goes
 * where the reference puts it — under the sentence, before the press, where it
 * is read rather than squinted at.
 */

export function CtaBanner() {
  return (
    /* No `isolate` and no `overflow-hidden`, and both absences are
       load-bearing. The footer is a *later sibling* that lifts up onto this
       section's picture with a negative margin — a stacking context here would
       trap the band above it, and a clip would cut the picture off at the
       exact line the card is supposed to overlap. */
    <section className="relative bg-lp-ground">
      {/* ---- The ask, on the page's own ground ------------------------- */}
      {/* `max-w-6xl px-6` is the page's one measure, and the column inside it
          caps at `3xl`: this is the one block on the page that is a centred
          sentence rather than a layout, and a heading run to 72rem reads as a
          strip of words rather than as an ask. See the note in
          `landing-page.tsx`. */}
      <div className="mx-auto max-w-6xl px-6 pt-16 pb-12 sm:pt-20 sm:pb-14">
        <div className="mx-auto max-w-3xl text-center">
          {/* One weight and one scale, from the same constant every other
              section heading on the page reads — so the last heading a reader
              meets is set like all the ones before it. The line break is kept:
              at this measure the sentence would otherwise turn after "Take",
              which puts the break inside the clause rather than between the
              two. */}
          <h2 className={`oc-display font-serif text-lp-ink ${SECTION_TITLE}`}>
            You have the book.
            <br />
            Take the order for free.
          </h2>

          {/* `lp-ink` rather than the `lp-soft` a lead takes elsewhere on the
              page. This is the last thing asked before the footer, and a grey
              chosen to sit quietly under a heading is the wrong weight for a
              closing sentence with a button under it. */}
          <p className="oc-lead mx-auto mt-5 max-w-xl font-serif text-lg leading-relaxed text-lp-ink sm:mt-6 sm:text-xl">
            Import the manuscript you already have. The first screen tells you
            what stands between it and a shop.
          </p>

          <p className="mt-6 text-[0.875rem] font-medium text-lp-ink">
            No card needed. Already have an account? Log in below.
          </p>

          {/* Both filled — see the note at the top of the file. */}
          <div className="mt-6 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Link
              href="/signup"
              className="w-full rounded-full bg-lp-accent px-7 py-3.5 text-[1.0625rem] font-semibold text-lp-accent-ink transition-opacity hover:opacity-90 sm:w-auto"
            >
              Start free
            </Link>
            <Link
              href="/signin"
              className="w-full rounded-full border border-lp-edge bg-lp-ground px-7 py-3.5 text-[1.0625rem] font-semibold text-lp-ink transition-colors hover:border-lp-edge-strong sm:w-auto"
            >
              Log in
            </Link>
          </div>
        </div>
      </div>

      {/* The sixteen tools going past, under the ask and above the footer —
          see `tool-marquee.tsx`. It sits outside the `max-w-6xl` column on
          purpose: a marquee that stops at the page's measure reads as a
          widget in a box, where one running the full width reads as the row
          carrying on past the screen, which is what it is. */}
      <div className="pb-14 sm:pb-16">
        <ToolMarquee />
      </div>
    </section>
  );
}
