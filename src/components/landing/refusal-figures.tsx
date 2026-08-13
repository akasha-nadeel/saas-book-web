import type { ReactNode } from "react";
import { AppWindow } from "@/components/landing/app-window";
import { DESTINATIONS } from "@/components/landing/works-with";
import { coverReport, type CoverFacts } from "@/lib/cover-check";

/**
 * A picture of the screen that catches each refusal, one per band.
 *
 * **These are pictures of real screens, and two of the three are computed
 * rather than written.** The refusal bands used to be words on both sides: the
 * injury on the left, a panel on the right saying what we do about it. Two
 * paragraphs facing each other is a claim answered by another claim, which is
 * the shape this reader has been burned by — and this is the one part of the
 * page that is about *their* problem, so it is the worst place to ask for
 * trust. A drawn screen is checkable in a way a sentence is not: the reader
 * can open the product and find it.
 *
 * **Drawn in markup, never screenshotted**, like every other figure here. A
 * screenshot is an asset that goes stale silently while the app moves, on the
 * one page whose whole pitch is being checkable.
 *
 * Two of them go further than quoting the screens, because they can:
 *
 * - The covers figure **runs `coverReport()`** over a fixed set of
 *   measurements, so every row, every label and the count in the summary line
 *   are the checker's own answers. Change a rule in `cover-check.ts` and this
 *   picture changes with it; it cannot drift, because there is nothing here to
 *   drift. The one thing written by hand is that the file is a PNG at 500 × 800
 *   — the picture's premise, like the book's title.
 * - The export figure **reads `DESTINATIONS`**, so the row of shops is the same
 *   list the footer and the real dialog use, filtered by the format the same
 *   way `export-done.tsx` filters it.
 *
 * The listing figure quotes its strings, since the form's copy lives inside
 * `publishing-card.tsx` rather than in a module either side can import. Its
 * ISBN is not decorative either: `978-0-306-40615-8` is the field's own
 * placeholder with the last digit moved by one, so it really does fail the
 * check digit the screen would run on it.
 *
 * **Why a second picture of the listing form, when `store-listing-demo.tsx`
 * already draws one.** That one shows the form filling itself in — six fields
 * arriving. This shows the same screen *refusing* something, which is the only
 * thing refusal 02 is about, and a demo of a form being filled in cannot make
 * that point. Same screen, different moment, different argument.
 *
 * All three are static. The two demos further down the page animate and pay
 * for it in machinery — an observer, a reduced-motion check, a camera that
 * measures with itself parked. A band the reader scrolls past does not need
 * any of that, and a page with five moving pictures on it is a page nobody
 * reads.
 */

/* ---------------------------------------------------------------------------
   Shared parts
   -------------------------------------------------------------------------- */

/**
 * The mark against one check — a cross or a tick.
 *
 * **A shape as well as a colour**, which is the covers screen's own rule and
 * not decoration: red-versus-green is the one distinction about one man in
 * twelve cannot make, and a checklist whose whole meaning is carried in a hue
 * fails for them completely.
 */
function Mark({ pass }: { pass: boolean }) {
  return (
    <span
      className={`mt-px flex h-4 w-4 shrink-0 items-center justify-center rounded-full ${
        pass ? "bg-ok-bg text-ok-fg" : "bg-stop-bg text-stop-fg"
      }`}
    >
      <svg
        viewBox="0 0 20 20"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.6"
        strokeLinecap="round"
        className="h-2.5 w-2.5"
      >
        {pass ? (
          <path d="M5 10.5l3.5 3.5L15 7" />
        ) : (
          <>
            <path d="M6 6l8 8" />
            <path d="M14 6l-8 8" />
          </>
        )}
      </svg>
    </span>
  );
}

/** The eyebrow every panel in this app puts over a group of facts. */
function Eyebrow({ children }: { children: ReactNode }) {
  return (
    <p className="font-code text-[0.5625rem] font-semibold tracking-[0.14em] text-lp-faint uppercase">
      {children}
    </p>
  );
}

/* ---------------------------------------------------------------------------
   01 — the covers screen
   -------------------------------------------------------------------------- */

/**
 * The premise of the picture, and the only invented thing in it: somebody has
 * dropped the file their design tool exported by default.
 *
 * A PNG at 500 × 800 is the ordinary shape of this mistake rather than a
 * contrived one — PNG is what every design tool and image generator writes
 * unless told otherwise, and a cover drawn to a screen-sized canvas lands
 * under both floors at once. Weight and contrast are set well clear of their
 * limits so the rows they produce are passes: the point of the picture is that
 * two things are wrong, not that everything is.
 */
const COVER_FILE: CoverFacts = {
  width: 500,
  height: 800,
  bytes: 412 * 1024,
  type: "image/png",
  contrast: 0.21,
  edge: 0.32,
};

const COVER_REPORT = coverReport(COVER_FILE);
const COVER_PROBLEMS = COVER_REPORT.filter(
  (check) => check.status === "problem",
).length;

/**
 * All three take the **pale ring** rather than the bezel, and they take it
 * together.
 *
 * They wore the bezel while the refusals were full-bleed bands on white, where
 * a pale ring on a pale ground disappears and the frame is what says "look
 * here". They sit on tinted cards now, each already framed by the card it is
 * in, and a black bezel inside that is a device inside a panel — two frames
 * around one screen. The ring is what `AppWindow` reserves for a figure
 * floating inside a section that is already about it, which is exactly what
 * these became.
 *
 * Whichever it is, it has to be the same answer three times: three screens
 * down one stretch of page in two different frames would read as two kinds of
 * thing rather than as three views of one product.
 */
export function CoverCheckFigure() {
  return (
    <AppWindow
      fill
      label="The covers screen, checking a 500 × 800 PNG: two things a shop would refuse, listed above the checks that passed."
    >
      <div className="p-4 sm:p-5">
        {/* The file, as the screen draws it: the picture, its name, and the
            measurements as a labelled list rather than a run of numbers. */}
        <div className="flex items-start gap-3.5">
          {/* The cover itself, drawn at the file's own proportions — so the
              shape the numbers describe is the shape on screen. */}
          <div
            aria-hidden
            style={{ aspectRatio: `${COVER_FILE.width} / ${COVER_FILE.height}` }}
            className="w-14 shrink-0 overflow-hidden rounded-[3px] bg-[#20232c] p-2 shadow-[0_2px_6px_-2px_rgba(15,15,16,0.4)]"
          >
            <div className="mt-4 h-[3px] w-8 rounded-full bg-[#c9a227]" />
            <div className="mt-2 h-[5px] w-11 rounded-full bg-white/85" />
            <div className="mt-1 h-[5px] w-7 rounded-full bg-white/85" />
          </div>

          <div className="min-w-0 flex-1">
            <p className="truncate text-[0.8125rem] font-medium text-lp-ink">
              cover-final.png
            </p>
            <dl className="mt-2 space-y-1 text-[0.6875rem]">
              {[
                [
                  "Pixels",
                  `${COVER_FILE.width.toLocaleString()} × ${COVER_FILE.height.toLocaleString()}`,
                ],
                [
                  "Shape",
                  `${(COVER_FILE.height / COVER_FILE.width).toFixed(2)}:1`,
                ],
                ["File", `${Math.round(COVER_FILE.bytes / 1024)}KB`],
              ].map(([label, value]) => (
                <div key={label} className="flex justify-between gap-4">
                  <dt className="text-lp-faint">{label}</dt>
                  <dd className="font-medium text-lp-ink tabular-nums">
                    {value}
                  </dd>
                </div>
              ))}
            </dl>
          </div>
        </div>

        {/* The summary line, counted from the rows below exactly as the screen
            counts it, so the two cannot disagree. */}
        <div className="mt-4 flex items-baseline gap-2 border-t border-lp-line pt-3">
          <p className="text-[0.8125rem] font-semibold text-lp-ink">
            {COVER_PROBLEMS} thing{COVER_PROBLEMS === 1 ? "" : "s"} a shop would
            refuse
          </p>
          <span className="text-[0.6875rem] text-lp-faint tabular-nums">
            {COVER_REPORT.length} checks
          </span>
        </div>

        {/* Every rule, pass and fail — which is the screen's own argument: a
            report listing only what is broken never says what was examined.
            The detail is drawn for the failures only, because a figure may
            crop what a screen must print in full. */}
        <ul className="mt-3 space-y-2.5">
          {COVER_REPORT.map((check) => {
            const failed = check.status !== "pass";
            return (
              <li key={check.id} className="flex items-start gap-2.5">
                <Mark pass={!failed} />
                <div className="min-w-0">
                  <p
                    className={`text-[0.75rem] leading-snug ${
                      failed
                        ? "font-semibold text-lp-ink"
                        : "font-medium text-lp-body"
                    }`}
                  >
                    {check.label}
                  </p>
                  {failed && (
                    <p className="mt-0.5 line-clamp-2 text-[0.6875rem] leading-relaxed text-lp-faint">
                      {check.detail}
                    </p>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      </div>
    </AppWindow>
  );
}

/* ---------------------------------------------------------------------------
   02 — the listing form, refusing a digit
   -------------------------------------------------------------------------- */

/**
 * One field of the listing form, drawn as `publishing-card.tsx` draws it:
 * label, box, and underneath it either the hint or — once the field has been
 * left — what is wrong with what was typed.
 */
function FormField({
  label,
  value,
  hint,
  error,
  chevron,
}: {
  label: string;
  value: string;
  hint?: string;
  error?: string;
  chevron?: boolean;
}) {
  return (
    <div>
      <p className="text-[0.6875rem] font-medium text-lp-ink">{label}</p>
      <div
        className={`mt-1.5 flex items-center gap-2 rounded-md border bg-lp-ground px-2.5 py-2 ${
          error ? "border-stop-line" : "border-lp-edge"
        }`}
      >
        <span className="min-w-0 flex-1 truncate text-[0.75rem] text-lp-ink">
          {value}
        </span>
        {chevron && (
          <svg
            viewBox="0 0 20 20"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="h-3 w-3 shrink-0 text-lp-faint"
          >
            <path d="M6 8l4 4 4-4" />
          </svg>
        )}
      </div>
      {error ? (
        <p className="mt-1 text-[0.625rem] leading-relaxed text-stop-fg">
          {error}
        </p>
      ) : (
        hint && (
          <p className="mt-1 text-[0.625rem] leading-relaxed text-lp-faint">
            {hint}
          </p>
        )
      )}
    </div>
  );
}

export function ListingFigure() {
  return (
    <AppWindow
      fill
      label="The listing form, with the ISBN box outlined in red and the words: that check digit doesn’t add up."
    >
      <div className="p-4 sm:p-5">
        <Eyebrow>Store listing</Eyebrow>

        <div className="mt-3 grid gap-3.5 sm:grid-cols-2">
          {/* The wrong digit, and it really is wrong: this is the field's own
              placeholder with its last digit moved by one. */}
          <FormField
            label="ISBN"
            value="978-0-306-40615-8"
            error="That check digit doesn’t add up."
          />
          <FormField label="Language" value="English" chevron />
          <FormField
            label="Publisher"
            value="Elena Rosa"
            hint="Your own name is the usual answer when self-publishing."
          />
          <FormField label="Publication date" value="08/02/2026" />
        </div>

        {/* The save bar every tool screen grows the moment there is something
            to lose — drawn here because this form is one of them, and because
            it is what says the answer is kept rather than merely checked. */}
        <div className="mt-4 flex items-center gap-3 rounded-lg border border-lp-edge bg-lp-well px-3 py-2.5">
          <p className="min-w-0 flex-1 truncate text-[0.6875rem] text-lp-body">
            Unsaved changes
          </p>
          <span className="rounded-md bg-lp-accent px-2.5 py-1 text-[0.625rem] font-semibold text-lp-accent-ink">
            Save
          </span>
        </div>
      </div>
    </AppWindow>
  );
}

/* ---------------------------------------------------------------------------
   03 — the file, finished
   -------------------------------------------------------------------------- */

/**
 * Where the EPUB opens, from the same list the real dialog reads and filtered
 * the same way — so this row cannot claim a shop the export does not reach.
 */
const EPUB_OPENS = DESTINATIONS.filter(
  (destination) => destination.format === "EPUB",
);

export function ExportDoneFigure() {
  return (
    <AppWindow
      fill
      label="The dialog after an export: your EPUB is ready, with the file’s name and size and the shops it opens in."
    >
      <div className="p-5 sm:p-6">
        <span className="flex h-9 w-9 items-center justify-center rounded-full bg-ok-bg text-ok-fg">
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.4"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="h-4 w-4"
          >
            <path d="m5 12.5 4.5 4.5L19 7" />
          </svg>
        </span>

        <p className="oc-heading mt-3 font-serif text-lg leading-tight text-lp-ink">
          Your EPUB is ready
        </p>
        <p className="mt-1.5 text-[0.6875rem] leading-relaxed text-lp-faint">
          Your browser has it. Where it puts a download is its own setting, so
          look wherever that is — the name is below.
        </p>

        <div className="mt-4 flex items-center gap-3 rounded-lg border border-lp-edge bg-lp-well px-3 py-2.5">
          <span className="min-w-0 flex-1">
            <span className="block truncate font-code text-[0.75rem] text-lp-ink">
              the-salt-road.epub
            </span>
            <span className="mt-0.5 block text-[0.625rem] text-lp-faint">
              1.4 MB
            </span>
          </span>
          <span className="shrink-0 rounded-md border border-lp-edge bg-lp-ground px-2.5 py-1 text-[0.625rem] font-semibold text-lp-ink">
            Save it again
          </span>
        </div>

        <div className="mt-4">
          <Eyebrow>It opens in</Eyebrow>
          <ul className="mt-2 flex flex-wrap gap-1.5">
            {EPUB_OPENS.map((destination) => (
              <li
                key={destination.name}
                className="rounded-md border border-lp-edge bg-lp-well px-2 py-1 text-[0.625rem] font-medium text-lp-ink"
              >
                {destination.name}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </AppWindow>
  );
}
