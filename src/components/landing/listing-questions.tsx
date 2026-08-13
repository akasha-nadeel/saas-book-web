"use client";

import { useId, useState } from "react";

/**
 * The three questions beside the listing form.
 *
 * **One is always open, and that is the whole reason this is a client
 * component.** It began as three `<details>` — the browser's own disclosure,
 * no JavaScript, findable by find-in-page — and that shape cannot promise what
 * the owner asked for: `<details>` lets a reader close the one that is open and
 * leave the column empty, and HTML's own exclusive accordion (`name=`) fixes
 * only the *other* half, that two can be open at once. So the open row is state
 * here, pressing the open row is a no-op rather than a toggle, and the column
 * never collapses to three lines and a lot of white beside a tall figure.
 *
 * The cost is stated rather than hidden: closed answers are no longer in the
 * DOM, so the browser's page search will not find their words. That is
 * acceptable for three sentences that are also a *paragraph* on the section
 * above; it would not be for the FAQ, which is why the FAQ keeps `<details>`.
 *
 * **A second disclosure style, and the context is what decides.** The FAQ draws
 * its rows as cards with a ringed chevron, because they are a stack of twelve
 * on an empty band and the card is what makes each one a control. These sit in
 * a column beside a figure, in a section made of nothing but words and a
 * screen — a card here would be a third kind of box in one row. So: hairline
 * rows, a bare chevron, a rule between. That is the shape the owner's reference
 * uses and the right one for this position.
 *
 * Every answer is a fact about the code. The ISBN's check digit really is
 * arithmetic on the number itself and really is checked as the field is left
 * (`isValidIsbn13`); the export really does run on a blank form
 * (`storeReadiness` reports and never vetoes); and the answers really are saved
 * to the book rather than to the export (`setPublishing`), and really do reach
 * the EPUB's metadata.
 */
const LISTING_QA: [question: string, answer: string][] = [
  [
    "Do I need an ISBN?",
    "Amazon assigns its own, so for a Kindle-only book you do not. Apple and Kobo want yours. The field says which under the box, and the check digit is arithmetic on the number itself — so a digit typed wrong is caught as you leave the field, rather than by a shop three days later.",
  ],
  [
    "What happens if I leave a field blank?",
    "The export still runs. Nothing here is required, because a file you want for your own reader is nobody else’s business. What you get instead is the pre-upload check, which names what a shop would refuse and never blocks the download.",
  ],
  [
    "Do I fill this in for every export?",
    "No. Every answer is saved to the book, so you answer once and it is still there for the next file, the next format and the next version — and it goes into the EPUB’s own metadata, which is where a shop reads it from.",
  ],
];

export function ListingQuestions() {
  const [open, setOpen] = useState(0);
  const id = useId();

  return (
    <div className="border-t border-lp-line">
      {LISTING_QA.map(([q, a], i) => {
        const isOpen = i === open;
        return (
          <div key={q} className="border-b border-lp-line">
            <h3>
              <button
                type="button"
                /* Pressing the open one keeps it open — see the note above.
                   `aria-expanded` still says which it is, so a screen reader
                   is told the state rather than left to infer it from a
                   chevron it cannot see. */
                onClick={() => setOpen(i)}
                aria-expanded={isOpen}
                aria-controls={`${id}-${i}`}
                className="group flex w-full cursor-pointer items-center justify-between gap-6 py-5 text-left outline-none focus-visible:ring-2 focus-visible:ring-lp-accent/60"
              >
                <span className="oc-heading font-serif text-[1.375rem] leading-snug font-semibold text-lp-ink sm:text-[1.5rem]">
                  {q}
                </span>
                <svg
                  viewBox="0 0 24 24"
                  aria-hidden="true"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={2}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  /* One glyph turned over rather than two swapped: the arrow
                     travels, so the row does not flicker as it opens. */
                  className={`h-5 w-5 shrink-0 transition-transform duration-200 ${
                    isOpen
                      ? "-rotate-180 text-lp-body"
                      : "text-lp-faint group-hover:text-lp-body"
                  }`}
                >
                  <path d="m6 9 6 6 6-6" />
                </svg>
              </button>
            </h3>

            {/* Stopped short of the chevron, so the answer reads as belonging
                to the line above it rather than as the next row.

                `lp-soft` rather than `lp-body`: one step darker at the owner's
                request, and it is the darkest of the greys that is still
                plainly not the ink — 8.9:1 on this ground against the ink's
                19:1, so the question still leads the row. */}
            {isOpen && (
              <p
                id={`${id}-${i}`}
                role="region"
                className="pr-10 pb-6 text-[1.0625rem] leading-[1.6] text-lp-soft"
              >
                {a}
              </p>
            )}
          </div>
        );
      })}
    </div>
  );
}
