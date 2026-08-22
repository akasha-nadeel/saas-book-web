import Image from "next/image";
import Link from "next/link";
import { AppWindow } from "@/components/landing/app-window";
import { CtaBanner } from "@/components/landing/cta-banner";
import { FeatureRow, ROW_GROUNDS } from "@/components/landing/feature-row";
import { LandingFooter } from "@/components/landing/landing-footer";
import { LandingHeader } from "@/components/landing/landing-header";
import {
  LEAD_EM,
  SECTION_LEAD,
  SECTION_TITLE,
} from "@/components/landing/type";
import { TOOL_MARK_HUES, TOOL_MARKS } from "@/components/shelf/tool-marks";
import { ALL_TOOLS, TOOL_GROUPS, type BookTool } from "@/lib/book-tools";
import { GUIDE_BY_PATH, type ToolGuide } from "@/lib/tool-guide";

/**
 * `/tools` — every tool, one at a time, in the words a customer needs.
 *
 * **It buys back what the tool cloud gave up.** The landing page used to carry
 * four cards naming all sixteen tools and what each was for; on 2026-08-15 that
 * became a scatter of marks around a count, which is a better *section* and a
 * worse *answer* — a cloud says how many there are and nothing about what any
 * of them does. The note in `tool-cloud.tsx` calls that a real loss and says so
 * outright. This page is where it went: the grouping is back, the sixteen names
 * are back, and each one has room to be explained rather than a pill's worth of
 * space. The cloud keeps its job of saying *how much there is*, and the button
 * under it comes here for *what it is*.
 *
 * **A page rather than an expanding section, and the arithmetic decides it.**
 * Sixteen rows of screen-plus-words is roughly three times the whole landing
 * page. Folded into it, the argument that page makes — the order, the refusals,
 * the check a visitor can run on their own manuscript — would be a preamble to
 * a catalogue. Kept apart, the landing page stays the pitch and this is the
 * reference somebody reads once they want one.
 *
 * **The layout is `feature-shots.tsx`'s, and it is literally that component.**
 * Same alternating rows, same tinted stages, same `<details>` disclosures —
 * shared through `feature-row.tsx` rather than copied, so the two sections
 * cannot drift a step apart. Nothing here is `"use client"`: like the rows on
 * the landing page, this whole page ships no JavaScript except the header's own
 * scroll behaviour.
 *
 * **The three sources are all the product's own.** The names, the marks and the
 * grouping come from `book-tools.ts`, the long descriptions from
 * `tool-guide.ts`, and a test fails if those two disagree. So a seventeenth
 * tool appears here by being added to the product, and cannot appear here
 * without being described.
 *
 * **The pictures are not here yet, and the space is reserved rather than
 * closed.** See `ToolShot` — every row draws a stand-in at the proportions a
 * capture will take, so dropping the screenshots in later moves nothing.
 */

/** The page's action colour, as `landing-page.tsx` names it. */
const INK = "var(--color-lp-accent)";

/**
 * The groups, each carrying its tools paired with what to say about them — and
 * each row's position **across the whole page** rather than within its group.
 *
 * That running number is what drives the zigzag and the cycling ground, and it
 * has to run through: restarted per group, the two groups holding an odd number
 * of tools would hand the next group a row on the same side as the one above
 * it, which is a stutter in the alternation exactly where the reader has just
 * been told they are somewhere new — it reads as a layout mistake rather than
 * as a new section.
 *
 * Built once at module scope rather than counted during the render. A
 * `let` incremented inside a `map` is the same arithmetic and is a lint error
 * for a real reason: it is state that survives the render it was written in.
 *
 * A tool with no guide entry is dropped rather than half-drawn — a heading over
 * an empty column is worse than an absence. `tool-guide.test.ts` is what stops
 * one ever getting this far; this is the belt to that pair of braces.
 */
const SECTIONS = (() => {
  let n = -1;
  return TOOL_GROUPS.map((group) => ({
    title: group.title,
    note: group.note,
    rows: group.tools.flatMap((tool) => {
      const guide = GUIDE_BY_PATH[tool.path];
      if (!guide) return [];
      n += 1;
      return [{ tool, guide, at: n }];
    }),
  }));
})();

export function ToolsPage() {
  return (
    // The landing page's own shell: pinned to daylight, scrolling itself
    // because `<body>` is `overflow-hidden` for the editor. See the long note
    // on `LandingPage` — every reason there applies unchanged here.
    <div
      data-theme="light"
      className="lp-type h-[var(--oc-layout-height)] overflow-y-auto bg-lp-ground text-lp-body [scroll-behavior:smooth]"
    >
      {/* `home={false}` roots the bar's two in-page anchors at `/`, for the
          reason the note on that prop gives. */}
      <LandingHeader ink={INK} home={false} />

      <main>
        {/* ---- What this page is ----------------------------------------

            No hero figure and no drop zone. A reader arrives here having
            already pressed something that said "what each tool does", so the
            job of the top of this page is to confirm they are in the right
            place and get out of the way — anything larger would be a second
            pitch in front of the thing they asked for. */}
        <section className="border-b border-lp-line px-6 pt-28 pb-14 sm:pt-32 sm:pb-20">
          <div className="mx-auto max-w-3xl text-center">
            <p className="font-code text-[0.6875rem] tracking-[0.18em] text-lp-faint uppercase">
              {/* Counted, never typed — the standing rule for anything
                  countable on these pages. */}
              All {ALL_TOOLS.length} tools
            </p>
            <h1
              className={`oc-display mt-5 font-serif text-lp-ink ${SECTION_TITLE}`}
            >
              What each one actually does
            </h1>
            <p className={`oc-lead mt-6 ${SECTION_LEAD}`}>
              Grouped the way they are grouped inside the app, so this page and
              the one you will be looking at are the same shape.{" "}
              <strong className={LEAD_EM}>
                Every one works on a real book rather than a sample.
              </strong>
            </p>

            <div className="mt-9 flex flex-wrap items-center justify-center gap-3">
              <Link
                href="/signup"
                style={{ backgroundColor: INK }}
                className="rounded-full px-6 py-3 text-[0.9375rem] font-semibold text-lp-accent-ink hover:opacity-90"
              >
                Start free
              </Link>
              {/* Back to the page they came from. A guide with no way back to
                  the pitch is a cul-de-sac, and the header's wordmark is a
                  logo rather than a labelled control. */}
              <Link
                href="/"
                className="rounded-full border border-lp-edge bg-lp-ground px-6 py-3 text-[0.9375rem] font-semibold text-lp-ink hover:border-lp-edge-strong"
              >
                Back to the overview
              </Link>
            </div>
          </div>
        </section>

        {/* ---- The four groups ------------------------------------------

            The group titles and notes are `book-tools.ts`'s own, so this page
            cannot name a group the app has renamed or invent one it does not
            have. */}
        {SECTIONS.map((group, g) => (
          <section
            key={group.title}
            /* Alternating section grounds, the reference's own device for
               telling long stacks of identical rows apart. `lp-tint-soft` is
               the page's existing lit band rather than a new value — a fifth
               ground would be a fifth thing to keep in step with the theme. */
            className={`border-b border-lp-line px-6 py-14 sm:py-20 ${
              g % 2 === 1 ? "bg-lp-tint-soft" : ""
            }`}
          >
            <div className="mx-auto max-w-[88rem]">
              <div className="mx-auto max-w-3xl text-center">
                <p className="flex items-center justify-center gap-2.5 font-code text-[0.6875rem] tracking-[0.18em] text-lp-faint uppercase">
                  <span
                    aria-hidden="true"
                    className="h-1.5 w-1.5 shrink-0 rounded-full bg-lp-faint"
                  />
                  {/* The group's place in the four, so a reader scrolling has
                      some idea how much is left. Counted from the source. */}
                  Group {g + 1} of {SECTIONS.length}
                </p>
                <h2
                  className={`oc-display mt-5 font-serif text-lp-ink ${SECTION_TITLE}`}
                >
                  {group.title}
                </h2>
                <p className={`oc-lead mx-auto mt-6 max-w-2xl ${SECTION_LEAD}`}>
                  {group.note}
                </p>
              </div>

              <div className="mt-14 flex flex-col gap-14 sm:mt-20 sm:gap-20">
                {group.rows.map(({ tool, guide, at }) => (
                  <FeatureRow
                    key={tool.path}
                    /* The tool's own path is its anchor, so the bar's Tools
                       menu can send a reader to one row rather than to the top
                       of the page. `book-tools.ts` already guarantees these are
                       unique — they are URL segments under
                       `/book/[bookId]/`. */
                    id={tool.path}
                    flip={at % 2 === 1}
                    ground={ROW_GROUNDS[at % ROW_GROUNDS.length]!}
                    eyebrow={<ToolName tool={tool} />}
                    title={guide.headline}
                    /* One sentence in two colours — the claim in ink, the rest
                       in deck grey — which is the arrangement `SECTION_LEAD`
                       documents and the whole page is set in. The two halves
                       join without a space because the lead begins with one; a
                       test asserts that so a new entry cannot break the seam
                       invisibly. */
                    lead={
                      <>
                        <strong className={LEAD_EM}>{guide.claim}</strong>
                        {guide.lead}
                      </>
                    }
                    points={guide.points}
                    figure={<ToolShot tool={tool} guide={guide} />}
                  />
                ))}
              </div>
            </div>
          </section>
        ))}
      </main>

      <CtaBanner />
      {/* `home={false}` roots the footer's in-page anchors at `/`. Without it
          three of its five columns point at sections that are not on this
          page and scroll nowhere. */}
      <LandingFooter home={false} />
    </div>
  );
}

/**
 * The tool's own mark and name, over the row's heading.
 *
 * **The mark is the load-bearing half.** A reader arriving from the landing
 * page has just watched sixteen coloured marks scatter out of a heading, and
 * they are the same objects they will meet in the app's Tools grid. Printing
 * the name alone here would make this page a third vocabulary for one set of
 * things; with the mark beside it, the cloud, this guide and the product are
 * visibly the same sixteen.
 *
 * The tile is `tool-cloud.tsx`'s, at a smaller size and without the float: a
 * pale plate mixed from the mark's own hue, so the colour stays inside the
 * mark. `TOOL_MARK_HUES` is the one place that hue lives, so a mark whose fill
 * changes takes its plate with it here too.
 */
function ToolName({ tool }: { tool: BookTool }) {
  const hue = TOOL_MARK_HUES[tool.icon] ?? "#146ef5";
  return (
    <p className="flex items-center gap-3">
      <span
        aria-hidden="true"
        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border"
        style={{
          backgroundColor: `color-mix(in srgb, ${hue} 10%, #ffffff)`,
          borderColor: `color-mix(in srgb, ${hue} 38%, #ffffff)`,
        }}
      >
        <svg viewBox="0 0 24 24" className="h-6 w-6">
          {TOOL_MARKS[tool.icon]}
        </svg>
      </span>
      <span className="font-code text-[0.6875rem] tracking-[0.18em] text-lp-faint uppercase">
        {tool.name}
      </span>
    </p>
  );
}

/**
 * The screen — or, until the captures exist, the space where one goes.
 *
 * **The stand-in is a drawing, not a gap and not a grey box saying "image".**
 * Three things follow from that, and they are the reason this is not simply an
 * empty div with a border:
 *
 * - **It reserves the real proportions.** The app's existing captures are about
 *   2:1 (`feature-shelf.webp` is 1893 × 948), so the stage is `aspect-[2/1]`
 *   and a capture dropped in later occupies exactly the space the drawing did.
 *   Nothing reflows, and nothing has to be re-measured against the words beside
 *   it.
 * - **It is honest about being a stand-in.** It draws the tool's mark on the
 *   window's own glass and says nothing about the screen it stands for, so it
 *   cannot make a claim that turns out to be wrong. A mocked-up interface here
 *   would be the one thing this site refuses everywhere else: a picture of
 *   software that does not look like the software.
 * - **It is announced as what it is.** `AppWindow`'s `label` hides the contents
 *   behind one description, so a reader who cannot see it is told there is a
 *   mark, not promised a screenshot that is not there.
 *
 * Once `guide.shot` is filled in, this takes the capture path and the drawing
 * is never rendered for that tool again.
 */
function ToolShot({ tool, guide }: { tool: BookTool; guide: ToolGuide }) {
  if (guide.shot) {
    return (
      <AppWindow label={guide.shot.alt}>
        {/* `quality={95}` and the same `sizes` as the landing page's captures:
            these are screens whose entire content is small type, and the one
            picture on this site that was squeezed hard has visible ringing on
            its letters. */}
        <Image
          src={guide.shot.src}
          alt=""
          width={guide.shot.width}
          height={guide.shot.height}
          sizes="(min-width: 1024px) 46rem, 100vw"
          quality={95}
          className="block h-auto w-full"
        />
      </AppWindow>
    );
  }

  const hue = TOOL_MARK_HUES[tool.icon] ?? "#146ef5";
  return (
    <AppWindow label={`The mark for ${tool.name}`}>
      <div className="flex aspect-[2/1] items-center justify-center bg-lp-well">
        <span
          className="flex h-20 w-20 items-center justify-center rounded-3xl border sm:h-24 sm:w-24"
          style={{
            backgroundColor: `color-mix(in srgb, ${hue} 10%, #ffffff)`,
            borderColor: `color-mix(in srgb, ${hue} 38%, #ffffff)`,
          }}
        >
          <svg viewBox="0 0 24 24" className="h-12 w-12 sm:h-14 sm:w-14">
            {TOOL_MARKS[tool.icon]}
          </svg>
        </span>
      </div>
    </AppWindow>
  );
}
