import { FormatMark } from "@/components/export/format-previews";
import { AppWindow } from "@/components/landing/app-window";
import { DEFAULT_TYPESET, templateById } from "@/lib/export/typeset";

/**
 * The last step of the export wizard, drawn rather than photographed.
 *
 * **This replaced `/export-tablet.webp` on 2026-08-14**, and it is the fix that
 * picture's own note asked for. The bitmap was composed by a script from a
 * screenshot that is no longer on disk — 1984×1326 in 49KB, about 0.15 bits a
 * pixel, which is the worst possible squeeze for what is in it: flat grounds
 * and small crisp type, where webp's ringing lands on the letters. There was
 * nothing to re-encode *from*, so the only way to sharpen it was to render it
 * again. That is this. The file stays in `public/` and the alt text it carried
 * is preserved below, so putting the photograph back is one `<Image>`:
 *
 *     "A tablet showing the last step of OpenChapter's export: the file
 *     breathe-again.epub with what it will contain — three chapters, four
 *     pages of front and back matter, the Classic template — and a green panel
 *     saying the book is ready for the shops, with the Export EPUB button
 *     below."
 *
 * **It is a picture of a screen, so it goes stale the way any drawing here
 * does — but far less of it can.** Two things are read from the app rather
 * than typed: the EPUB glyph on the file card is the export's own `FormatMark`,
 * and "Classic" is `templateById(DEFAULT_TYPESET.template).name` out of the
 * pure `typeset.ts`. Everything else is quoted by hand, because the strings
 * that would say it live in `export-page.tsx`, which is `"use client"` — a
 * Server Component importing a value from a client module gets a client
 * *reference* rather than the value, which is the `sections.ts` lesson and a
 * 500 rather than a wrong word. So this is the list to walk when that screen
 * moves: the rail groups, the step counter, the step's title and deck, the
 * four summary rows, the readiness panel's two lines, and the two buttons.
 * **It has already gone stale once and nothing warned**, which is the standing
 * cost of quoting a client module by hand: the Preview step ("Read it before
 * you send it") was added to every format and this drawing went on saying
 * "Step 7 of 7" over five groups. Walk `stepsFor("epub")` when you touch it.
 *
 * **The frame is `AppWindow` with the bezel**, not a device of its own — the
 * same frame and the same volume the prepare row's demo two rows above uses,
 * which is what keeps this section from reading as two products photographed
 * on two machines.
 *
 * **Nothing here scales in pixels.** The screen is a fixed design in `W × H`
 * with every size written in `cqw` against the container query on the glass,
 * so one set of proportions holds at any column width — the same mechanism the
 * export wizard's own page sheet uses, and the reason this needs no script.
 * The section it sits in ships none.
 */

/* The design the `cqw` figures below are proportions of: 1 design px = 0.1cqw.
   The aspect matches the tablet the photograph drew, so the row's height does
   not move. */
const W = 1000;
const H = 660;

/**
 * The wizard's six groups for an EPUB, in order, with Export standing last
 * and current.
 *
 * Eight steps in six groups is what `stepsFor("epub")` builds — Formatting and
 * Store listing hold two apiece, the rest one each — which is where the rail's
 * step counter comes from. Quoted rather than imported; see the note above.
 */
const GROUPS = [
  "Format",
  "Formatting",
  "Front matter",
  "Store listing",
  "Preview",
  "Export",
] as const;

/**
 * How many steps the rail is counting, which is not how many groups it draws.
 *
 * Formatting and Store listing are two steps apiece, so the counter runs ahead
 * of the circles. Written out rather than derived from `GROUPS`, because the
 * two genuinely are different numbers and an arithmetic that made them agree
 * would be wrong.
 */
const STEP_COUNT = 8;

/**
 * What the file will contain, as the real step says it back.
 *
 * "Front matter: contents" is not a truncation — it is what the screen prints
 * for a book that carries a title page of its own and has no author name to
 * put on a copyright page, which is the book in this picture.
 */
const SUMMARY: [string, string][] = [
  ["Chapters", "3 chapters"],
  ["Your own pages", "4 pages of front and back matter"],
  ["Template", templateById(DEFAULT_TYPESET.template).name],
  ["Front matter", "contents"],
];

export function ExportScreen() {
  return (
    <AppWindow
      bezel
      label="The last step of OpenChapter's export: the file breathe-again.epub with what it will contain — three chapters, four pages of front and back matter, the Classic template — and a green panel saying the book is ready for the shops, with the Export EPUB button below."
      screenStyle={{ aspectRatio: `${W} / ${H}` }}
      screenClassName="@container flex overflow-hidden bg-lp-raised leading-[1.35]"
    >
      {/* ---- the rail -----------------------------------------------------
          Full height and white, with the desk grey only under the step
          itself — which is what the real screen does, the rail and the action
          bar sharing `bg-nav` while the scrolling middle sits on `bg-surface`. */}
      <aside className="flex w-[22.5cqw] shrink-0 flex-col border-r border-lp-edge bg-lp-ground px-[2.4cqw] py-[2.6cqw]">
        <p className="text-[1.1cqw] font-semibold text-lp-body">← All tools</p>

        {/* The book, with its cover. It is on this screen for the reason the
            rail's own comment gives: landing on the wrong manuscript here is a
            way to publish the wrong book. */}
        <div className="mt-[1.7cqw] flex items-start gap-[1.1cqw]">
          <Cover />
          <span className="min-w-0">
            <span className="block truncate text-[1.3cqw] font-semibold text-lp-ink">
              Breathe Again
            </span>
            <span className="mt-[0.3cqw] block text-[1.05cqw] text-lp-faint">
              3 chapters · 672 words
            </span>
          </span>
        </div>

        <p className="mt-[2cqw] text-[1cqw] font-semibold tracking-[0.14em] text-lp-faint uppercase">
          Step {STEP_COUNT} of {STEP_COUNT}
        </p>

        <ol className="mt-[2.6cqw] space-y-[2.2cqw]">
          {GROUPS.map((name, i) => {
            /* Export is last and is where the writer is standing, which is the
               whole of what this picture is about — so the four above it are
               behind you and the thread between them is filled. */
            const current = i === GROUPS.length - 1;
            return (
              <li
                key={name}
                className="relative flex items-center gap-[1.3cqw]"
              >
                {/* The thread, run from under this circle into the gap below so
                    it reaches the next one. */}
                {!current && (
                  <span className="absolute top-[2.2cqw] -bottom-[2.2cqw] left-[1cqw] w-[0.2cqw] rounded-full bg-lp-accent" />
                )}
                {/* Filled for done *and* current: the circle answers "have I
                    been here", and where you are standing is somewhere you
                    have been. */}
                <span className="relative flex h-[2.2cqw] w-[2.2cqw] shrink-0 items-center justify-center rounded-full bg-lp-accent text-[1.05cqw] font-semibold text-lp-accent-ink">
                  {current ? GROUPS.length : <Tick />}
                </span>
                <span
                  className={`text-[1.3cqw] ${
                    current ? "font-semibold text-lp-ink" : "text-lp-body"
                  }`}
                >
                  {name}
                </span>
              </li>
            );
          })}
        </ol>

        {/* The way out, at the foot of the rail where the real screen puts it
            — quiet, and never mistakable for a step. */}
        <p className="mt-auto text-[1.2cqw] text-lp-body underline underline-offset-4">
          Back to writing
        </p>
      </aside>

      {/* ---- the step ----------------------------------------------------- */}
      <div className="flex min-w-0 flex-1 flex-col">
        {/* Nothing on this row acts on the step. Both directions live on the
            action bar at the foot; what is up here is the road's own tick. */}
        <header className="flex shrink-0 justify-end px-[3.4cqw] pt-[2.4cqw]">
          <span className="rounded-[0.9cqw] border border-lp-edge px-[1.4cqw] py-[0.75cqw] text-[1.2cqw] font-semibold text-lp-ink">
            <span className="mr-[0.5cqw] text-lp-faint">✓</span>
            Mark step done
          </span>
        </header>

        <div className="min-h-0 flex-1 px-[3.4cqw] pt-[2cqw]">
          <h1 className="font-serif text-[2.5cqw] text-lp-ink">
            Take it out of here
          </h1>
          <p className="mt-[0.8cqw] text-[1.5cqw] font-medium text-lp-body">
            Everything is set. Here is what you are about to get.
          </p>

          {/* The file, named. What a writer cannot know is what lands in the
              downloads folder, which is the one thing a download tells nobody
              — so the filename is the card's own heading. */}
          <div className="mt-[2.6cqw] overflow-hidden rounded-[1.2cqw] border border-lp-edge bg-lp-ground">
            <div className="flex items-center gap-[1.4cqw] border-b border-lp-edge px-[1.6cqw] py-[1.5cqw]">
              <span className="flex h-[4.4cqw] w-[4.4cqw] shrink-0 items-center justify-center rounded-[1cqw] bg-lp-raised text-lp-ink">
                <FormatMark format="epub" className="h-[2.2cqw] w-[2.2cqw]" />
              </span>
              <span className="min-w-0">
                <span className="block truncate text-[1.45cqw] font-semibold text-lp-ink">
                  breathe-again.epub
                </span>
                <span className="mt-[0.3cqw] block text-[1.2cqw] text-lp-faint">
                  One .epub file
                </span>
              </span>
            </div>

            <dl className="divide-y divide-lp-edge">
              {SUMMARY.map(([term, value]) => (
                <div
                  key={term}
                  className="flex items-baseline gap-[1.6cqw] px-[1.6cqw] py-[1.05cqw] text-[1.3cqw]"
                >
                  <dt className="text-lp-body">{term}</dt>
                  <dd className="ml-auto text-right font-medium text-lp-ink">
                    {value}
                  </dd>
                </div>
              ))}
            </dl>
          </div>

          {/* The honest half of "publish": what a shop would say about this
              file, said before the upload rather than after it. The status
              family's own green, which is one of the two places on this page a
              colour carries a fact. */}
          <div className="mt-[1.5cqw] flex items-start gap-[1.1cqw] rounded-[1.2cqw] border border-ok-line bg-ok-bg px-[1.6cqw] py-[1.3cqw]">
            <span className="mt-[0.2cqw] shrink-0 text-ok-fg">
              <Tick className="h-[1.6cqw] w-[1.6cqw]" />
            </span>
            <span className="min-w-0">
              <span className="block text-[1.35cqw] font-semibold text-ok-fg">
                Ready for the shops.
              </span>
              <span className="mt-[0.25cqw] block text-[1.2cqw] text-lp-body">
                Cover, metadata and images are all in order.
              </span>
            </span>
          </div>
        </div>

        {/* The action bar, and it stands still — the same bar on every step,
            with the export itself standing where Continue stands everywhere
            else. */}
        <footer className="flex shrink-0 items-center border-t border-lp-edge bg-lp-ground px-[3.4cqw] py-[1.5cqw]">
          <span className="flex items-center gap-[0.7cqw] rounded-[0.9cqw] border border-lp-edge bg-lp-ground px-[1.6cqw] py-[1cqw] text-[1.3cqw] font-medium text-lp-ink">
            <Arrow className="rotate-180" />
            Back
          </span>
          <span className="ml-auto flex items-center justify-center gap-[0.7cqw] rounded-[0.9cqw] bg-lp-accent px-[2cqw] py-[1.05cqw] text-[1.3cqw] font-semibold text-lp-accent-ink">
            Export EPUB
            <Arrow />
          </span>
        </footer>
      </div>
    </AppWindow>
  );
}

/**
 * The book's cover in the rail, drawn as a cloth one.
 *
 * `BookCover` is the app's own and would have been the honest import, but it
 * is `"use client"` — pulling it in would put JavaScript on a row that ships
 * none. So this is the shape that component draws for a book with no artwork:
 * a graphite cloth from its own palette, with the title as two bands, which is
 * all a 34px cover can honestly show.
 */
function Cover() {
  return (
    <span
      style={{ aspectRatio: "2 / 3" }}
      className="block w-[3.4cqw] shrink-0 overflow-hidden rounded-[0.35cqw]
                 bg-linear-to-b from-[#4a4a4a] to-[#3a3a3a] shadow-sm"
    >
      <span className="mx-auto mt-[32%] block h-[0.22cqw] w-[62%] rounded-full bg-white/70" />
      <span className="mx-auto mt-[0.3cqw] block h-[0.22cqw] w-[44%] rounded-full bg-white/45" />
    </span>
  );
}

/** The wizard's own tick, at the wizard's own weight. */
function Tick({ className = "h-[1.2cqw] w-[1.2cqw]" }: { className?: string }) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 20 20"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.4"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <path d="M4.5 10.5l3.5 3.5 7-7.5" />
    </svg>
  );
}

/** And its arrow, which the two buttons on the action bar carry. */
function Arrow({ className = "" }: { className?: string }) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 20 20"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={`h-[1.4cqw] w-[1.4cqw] shrink-0 ${className}`}
    >
      <path d="M4 10h11M11 6l4 4-4 4" />
    </svg>
  );
}
