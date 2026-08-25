import Link from "next/link";
import type { ReactNode } from "react";
import { ToolMarquee } from "@/components/landing/tool-marquee";
import { SECTION_LEAD, SECTION_TITLE } from "@/components/landing/type";

/**
 * The closing ask — the last thing on the page before the footer.
 *
 * **It closes on the gradient the page opened on**, which is the arrangement
 * that makes the whole thing read as one piece rather than as a stack of
 * bands: a reader arrives on that colour and leaves on it. `.oc-gradient-field`
 * is the same class the hero takes and the same file behind it — an abstract
 * blur has no subject to frame, so a second crop of it would buy nothing.
 *
 * **Three artworks have stood here and the notes on the first two are worth
 * keeping**, because each failed in a way that is a property of the picture
 * rather than of this layout. First an indigo sky with a drawn app window,
 * whose gradient landed on the footer's ground. Then a photographed landscape,
 * with the footer riding up onto it as a card. Then a doorway in a pale field,
 * which took near-black type and no overlay at all. The lesson under all three:
 * the ask is a fixed stack of pixels while the frame scales with the width, so
 * the share of the picture it covers grows as the window narrows — probing
 * four widths with the landscape put the caveat line at 41% of the frame at
 * 1280 and 58% at 390, out over open water at 2.2:1.
 *
 * A gradient is the one kind of image that cannot fail that way, because there
 * is no composition for the type to drift across. The contrast working — why
 * the stack sits in the upper two thirds and what the fade at the foot is
 * doing — is in `globals.css` beside `.oc-gradient-field`.
 *
 * **One button, not two.** The reference closes on a single press and it is
 * right to: the pair belongs in the header, where a returning writer needs the
 * way back in; down here the page has already made its case and a second,
 * quieter option beside the ask is a place to hesitate.
 */
export function CtaBanner({
  /**
   * The ask itself, and the reason these are props.
   *
   * **Two products share this closing section.** The default words are the
   * sixteen-tool page's positioning — the *order* nobody tells you — and the
   * marquee under them is the sixteen tools going past. Neither is true of the
   * launch MVP, whose tool screens the proxy redirects home, so it hands in its
   * own sentence and switches the row off. Everything else about the section is
   * shared on purpose: one closing image, one pair of buttons, one measure.
   *
   * The line break in the default heading is kept: at this measure the sentence
   * would otherwise turn after "Take", which puts the break inside the clause
   * rather than between the two.
   */
  title = (
    <>
      You have the book.
      <br />
      Take the order for free.
    </>
  ),
  lead = "Import the manuscript you already have. The first screen tells you what stands between it and a shop.",
  /** The sixteen tools going past, under the ask. Off where there are none. */
  marquee = true,
}: {
  title?: ReactNode;
  lead?: string;
  marquee?: boolean;
} = {}) {
  return (
    <section className="oc-gradient-field">
      {/* The stack lives in the upper two thirds of the section — see the
          measurement beside `.oc-gradient-field`. The padding is what puts it
          there: heavier at the foot than the head, so the bloom at the bottom
          of the gradient is what the reader's eye ends on rather than the
          button. */}
      <div className="mx-auto max-w-6xl px-6 pt-20 pb-32 sm:pt-24 sm:pb-40">
        <div className="mx-auto max-w-2xl text-center">
          {/* **A step heavier than the page's other section titles, and the
              picture is the reason.** `SECTION_TITLE` is `medium`, which is
              right on flat ground where a heading has nothing competing with
              it; on the gradient the same weight reads as thin. This is the
              one heading on the page allowed to differ, and it differs in
              weight alone — the size is still the shared constant, so it does
              not become a second scale. The hero's title made the same move.
              If the artwork ever goes, this override goes with it. */}
          <h2
            className={`oc-display font-serif font-semibold text-lp-ink ${SECTION_TITLE}`}
          >
            {title}
          </h2>

          <p className={`oc-lead mx-auto mt-5 max-w-xl ${SECTION_LEAD}`}>
            {lead}
          </p>

          <div className="mt-8 flex justify-center">
            <Link
              href="/signup"
              className="rounded-full bg-lp-ink px-7 py-3 text-[0.9375rem] font-medium text-lp-ground transition-opacity hover:opacity-90"
            >
              Start writing free
            </Link>
          </div>
        </div>
      </div>

      {/* The sixteen tools going past, under the ask and above the footer —
          see `tool-marquee.tsx`. It sits outside the `max-w-6xl` column on
          purpose: a marquee that stops at the page's measure reads as a
          widget in a box, where one running the full width reads as the row
          carrying on past the screen, which is what it is. */}
      {marquee ? (
        <div className="pb-14 sm:pb-16">
          <ToolMarquee />
        </div>
      ) : (
        /* The marquee's own bottom padding, kept, so the section ends the same
           distance above the footer's rule either way. */
        <div className="pb-14 sm:pb-16" />
      )}
    </section>
  );
}
