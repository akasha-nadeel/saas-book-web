import Link from "next/link";
import { AppWindow } from "@/components/landing/app-window";
import { ALL_TOOLS } from "@/lib/book-tools";
import { PHASES, STEPS } from "@/lib/roadmap";

/**
 * The closing banner — the last thing before the footer, and the page's last
 * ask.
 *
 * **The shape is borrowed on purpose, the contents are not.** The reference is
 * the app-store close every consumer product ships: a lit sky that fades into
 * the footer, the sentence and the buttons held left, and the product itself
 * over on the right, oversized and cropped by the bottom edge so the section
 * looks like a window onto something bigger. Three things make that layout
 * work and all three are kept here.
 *
 * - **The gradient ends in the footer's own ground.** In the reference the sky
 *   goes to white and the footer is white, so the two read as one closing
 *   movement rather than as a coloured block with a page stuck under it. Ours
 *   ends on `--color-lp-ground`, which is what the footer is painted with — in
 *   *both* themes, which is why the two stops are tokens rather than literals.
 * - **The device is cropped, and that is the message.** A figure that fits
 *   inside its section is a picture; one running past the edge says there is
 *   more of this than the page has room for. It is a fixed-width drawing that
 *   bleeds right and bottom, so a narrower window simply crops more of it —
 *   no scaling, no measuring, nothing to go stale.
 * - **The floats are what stop it being a screenshot.** Cards lifted off the
 *   screen and overlapping its edges are the whole visual trick of this
 *   layout; they also carry the three facts most worth leaving a reader with.
 *
 * **What could not be borrowed.** The reference's two buttons are App Store
 * and Google Play badges, and there is no OpenChapter app to download — a
 * badge for a thing that does not exist is the one claim this page can least
 * afford. They keep the badge *shape* (mark, small line, loud line, rounded
 * slab) because that shape is doing real work — it lets a button carry its own
 * caveat — and the two real ways in go in it. The reference's floating search
 * and notification circles went inside the drawn window, where a desktop app
 * actually puts them; hanging over a banner they would be controls that do
 * nothing, which the house rules forbid.
 *
 * **It is a picture and says so.** `AppWindow` takes a `label` here, so the
 * whole drawing is one described image rather than sixty unreadable fragments
 * announced one at a time. It is the same window the two demos higher up the
 * page sit in — there is one frame on this page and this is it, or a reader
 * meets three products.
 *
 * Every figure in it is imported and counted: the phase labels come from
 * `PHASES`, the next step from `STEPS`, the tool count from `ALL_TOOLS`. The
 * findings are the real screen's own strings, the same ones `check-demo.tsx`
 * quotes. So this can only go wrong if the product does.
 */

/* ---- The drawn interface's glyph set -------------------------------------
 *
 * Local rather than shared, the way `check-demo.tsx` keeps its own: these are
 * drawn *inside* a picture of the app at 13px, where the page's own 24-grid
 * icon set is sized and weighted for reading at 18px and up. One grid, one
 * weight, so the sidebar reads as one set. */
const PATHS = {
  overview: "M4 18h4v-4H4zM10 14h4v-4h-4zM16 10h4V6h-4z",
  write: "M4 20h16M14.5 4.5a2.1 2.1 0 0 1 3 3L9 16l-4 1 1-4Z",
  prepare: "M3.5 7.5 12 3l8.5 4.5v9L12 21l-8.5-4.5Zm5 4.5 2.5 2.5 4.5-5",
  track: "M4 19V5m0 14h16m-12-4 3.5-4 3 2.5L20 8",
  tools: "M14.5 5.5a3.5 3.5 0 0 0 4.6 4.6l-8 8a2.3 2.3 0 0 1-3.2-3.2ZM5 5l3 3",
  people: "M9 11a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7Zm-6 9c0-3.3 2.7-5.5 6-5.5s6 2.2 6 5.5m1.5-15a3.5 3.5 0 0 1 0 7M17 14.8c2.4.5 4 2.4 4 5.2",
  search: "M11 18a7 7 0 1 0 0-14 7 7 0 0 0 0 14Zm5.2-1.8 3.8 3.8",
  bell: "M12 3a6 6 0 0 0-6 6c0 4-1.5 5.5-1.5 5.5h15S18 13 18 9a6 6 0 0 0-6-6Zm-2 12.5a2 2 0 0 0 4 0",
  check: "m5 12.5 4.5 4.5L19 7",
  shelf: "M4 20h16M6.6 7.4h3.8v12.6H6.6zM12.6 20 15.4 8.3l3.4.8L16.4 20Z",
  blurb: "M4.5 7h15M4.5 12h15M4.5 17h9",
  formats: "M5.5 3.5h8L18.5 8v12.5h-13Zm8 0V8h5",
  arrow: "M5 12h13m-5.5-5.5L18.5 12l-6 5.5",
  spark: "M12 3.5 13.8 9l5.7 1.8-5.7 1.8L12 18.5l-1.8-5.9L4.5 10.8 10.2 9Z",
} as const;

function Ico({
  name,
  size = 13,
  className = "",
}: {
  name: keyof typeof PATHS;
  size?: number;
  className?: string;
}) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      aria-hidden="true"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.7}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={`shrink-0 ${className}`}
    >
      <path d={PATHS[name]} />
    </svg>
  );
}

/**
 * The six areas of the dashboard, in the order the sidebar lists them.
 *
 * Write is one of six rather than the whole product, which is the argument the
 * real sidebar is making and the reason this figure shows the sidebar at all.
 */
const AREAS = [
  { label: "Overview", icon: "overview" },
  { label: "Write", icon: "write" },
  { label: "Prepare", icon: "prepare" },
  { label: "Track", icon: "track" },
  { label: "Tools", icon: "tools" },
  { label: "Collaborators", icon: "people" },
] as const;

/**
 * Three of `checkup()`'s findings, worst first, each with the control that
 * fixes it — the pairing being the whole claim.
 *
 * The strings are the dashboard's own, the same ones `check-demo.tsx` quotes,
 * so the two figures on this page cannot end up describing different products.
 * Red is *a shop would refuse this*, amber is *worth doing* — the app's own
 * ladder, not a decoration.
 */
const FINDINGS = [
  {
    tone: "stop",
    text: "There is nothing in the book to publish yet.",
    action: "Open the book",
  },
  {
    tone: "note",
    text: "No blurb. This is the text a shop shows under the cover.",
    action: "Work on the blurb",
  },
  {
    tone: "note",
    text: "No categories. These decide which shelf the book turns up on.",
    action: "Choose categories",
  },
] as const;

/** The first Prepare step, read from the road rather than retyped. */
const NEXT_STEP = STEPS.find((step) => step.phase === "prepare");

const LABEL =
  "A drawn recreation of the OpenChapter dashboard on a laptop screen. A sidebar " +
  "lists the six areas — Overview, Write, Prepare, Track, Tools, Collaborators — " +
  "with Overview open. The book The Salt Road is named across the top, and under it " +
  "three findings, worst first: there is nothing in the book to publish yet, no blurb, " +
  "no categories. Each finding carries the control that fixes it. Below them sit the " +
  "five phases of the road — Write, Revise, Prepare, Before you publish, Publish — " +
  "and the next step. Cards float over the screen showing the book's two counts, " +
  "three of the tools, and the export's zero EPUBCheck errors.";

export function CtaBanner() {
  return (
    /*
     * `isolate` and a painted layer rather than a background on the section
     * itself: the drawn window has to sit *above* the gradient and below
     * nothing, and a stacking context declared here is what keeps the floats
     * from needing z-indexes of their own.
     *
     * `overflow-hidden` is load-bearing twice — it is what crops the window at
     * the bottom edge (the whole point of the composition) and what stops the
     * bleed to the right from giving the page a horizontal scrollbar.
     */
    <section className="relative isolate overflow-hidden">
      {/* The sky.
          Three stops, not two: the first two are the same deep indigo, which
          holds the top 45% of the section flat so every word on it sits on a
          ground white type clears comfortably. The fade then happens in the
          half where only the drawing is, and lands on the footer's own ground
          so the seam between the two sections disappears. */}
      <div
        aria-hidden="true"
        className="absolute inset-0 -z-10 [background:linear-gradient(180deg,var(--color-lp-cta-top)_0%,var(--color-lp-cta-top)_42%,var(--color-lp-cta-mid)_74%,var(--color-lp-ground)_100%)]"
      />

      {/* `max-w-6xl px-6` — the page's one measure, shared with the header and
          every section. The drawn window is the only thing here allowed
          outside it, and it earns that by *bleeding off* the edge rather than
          by starting further out. See the note in `landing-page.tsx`. */}
      <div className="mx-auto max-w-6xl px-6 pt-16 sm:pt-20 lg:pt-24">
        <div className="lg:grid lg:grid-cols-[minmax(0,22rem)_minmax(0,1fr)] lg:gap-8">
          {/* ---- The ask ------------------------------------------------ */}
          <div className="lg:pt-6 lg:pb-24">
            {/* **One weight, like every other heading on the page.** The
                banner's layout reference splits its headline into a light half
                and a bold half, and set in this grotesque that is two
                typographic voices in one sentence — the eye reads a break
                where the sentence has none. The page's section headings are
                one even weight at a size that does the ranking, and this is
                the same `oc-heading` treatment at the same scale, so the last
                heading a reader meets is set like all the ones before it.

                The line break is kept: at this measure the sentence would
                otherwise turn after "Take", which puts the break inside the
                clause rather than between the two. */}
            <h2 className="oc-heading font-serif text-[1.75rem] leading-tight text-lp-accent-ink sm:text-4xl lg:text-[2.75rem]">
              You have the book.
              <br />
              Take the order for free.
            </h2>

            <p className="oc-lead mt-5 max-w-md font-serif text-lg leading-relaxed text-lp-accent-pale sm:mt-6 sm:text-xl">
              Import the manuscript you already have and the first screen tells
              you what stands between it and a shop. If any of it does not work,
              you have lost an afternoon.
            </p>

            {/* The badge pair.
                Shape borrowed from the store badges the reference puts here,
                because that shape lets a button carry its own caveat on the
                line above the label — which is exactly what both of these need
                to say and what a bare pill has no room for. */}
            <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center">
              <Badge
                href="/signup"
                icon="spark"
                over="No card needed"
                label="Start free"
                primary
              />
              <Badge
                href="/signin"
                icon="people"
                over="Already have an account"
                label="Log in"
              />
            </div>
          </div>

          {/* ---- The product, cropped -----------------------------------

              A fixed-width drawing in a shorter viewport: the window is about
              500px tall and this box is 26rem, so the last inch of it runs
              past the section and is cut by the `overflow-hidden` above. That
              cut is the composition — see the note at the top of the file.

              It is centred at small widths and left-anchored from `lg`, so a
              phone crops both edges evenly onto the findings (the part worth
              seeing) while a desktop crops only the right, where the window
              runs under the page margin. */}
          <div className="relative mt-12 h-[19rem] sm:h-[23rem] lg:mt-0 lg:h-[26rem]">
            <div className="absolute top-0 left-1/2 w-[54rem] -translate-x-1/2 lg:left-0 lg:translate-x-0">
              <AppWindow label={LABEL} screenClassName="bg-lp-ground">
                <Screen />
              </AppWindow>
            </div>

            {/* ---- The floats -------------------------------------------

                Hidden below `lg`: at those widths the window is centred and
                cropped on both sides, so a card pinned to its left edge would
                sit over the middle of the drawing rather than off it. They
                are decoration in the strict sense — every fact on them is
                also stated in words elsewhere on the page — so nothing is
                lost by their absence, which is what makes hiding them
                allowed. `aria-hidden` because the window's own label already
                describes them. */}
            <div
              aria-hidden="true"
              className="pointer-events-none hidden lg:block"
            >
              {/* The book, over the left edge — the reference's profile card,
                  in the terms this product deals in: a cover, a title, and
                  the two counts the Overview leads with. */}
              <div className="absolute top-[4.5rem] -left-10 flex w-[16.5rem] items-center gap-3 rounded-2xl border border-lp-edge bg-lp-ground/95 p-3 shadow-[0_18px_40px_-18px_rgba(15,15,16,0.45)] backdrop-blur-sm">
                <Cover />
                <div className="min-w-0">
                  <p className="truncate text-[0.8125rem] font-semibold text-lp-ink">
                    The Salt Road
                  </p>
                  <div className="mt-1.5 flex items-center gap-1.5">
                    <Pill tone="stop">1 to fix</Pill>
                    <Pill tone="note">4 worth doing</Pill>
                  </div>
                </div>
              </div>

              {/* Three of the sixteen, as the tool bar the dashboard's Tools
                  area draws them in. The reference has the same bar in the
                  same corner with its middle control lit. */}
              <div className="absolute bottom-16 -left-6 flex items-center gap-1 rounded-2xl border border-lp-edge bg-lp-ground/95 p-2 shadow-[0_18px_40px_-18px_rgba(15,15,16,0.45)] backdrop-blur-sm">
                <Tool icon="shelf" label="Comps" />
                <Tool icon="blurb" label="Blurb" lit />
                <Tool icon="formats" label="Export" />
              </div>

              {/* The two counted facts, stacked and staggered off the right of
                  the window the way the reference stacks its trend tiles.
                  Both are counted out of the source — the tool list and the
                  EPUBCheck result the export section states — because this is
                  the slot a SaaS page fills with a growth percentage and
                  there is no honest one of those to print. */}
              <div className="absolute top-[10.5rem] left-[31rem] w-[11rem] rounded-2xl border border-lp-edge bg-lp-ground/95 p-3.5 shadow-[0_18px_40px_-18px_rgba(15,15,16,0.45)] backdrop-blur-sm">
                <div className="flex items-center gap-2 text-lp-accent-text">
                  <Ico name="tools" size={15} />
                  <span className="font-serif text-xl leading-none font-semibold text-lp-ink">
                    {ALL_TOOLS.length}
                  </span>
                </div>
                <p className="mt-1.5 text-[0.6875rem] leading-snug text-lp-faint">
                  tools, all included
                </p>
              </div>

              <div className="absolute top-[16.5rem] left-[34.5rem] w-[11rem] rounded-2xl border border-lp-edge bg-lp-ground/95 p-3.5 shadow-[0_18px_40px_-18px_rgba(15,15,16,0.45)] backdrop-blur-sm">
                <div className="flex items-center gap-2 text-ok-fg">
                  <Ico name="check" size={15} />
                  <span className="font-serif text-xl leading-none font-semibold text-lp-ink">
                    0
                  </span>
                </div>
                <p className="mt-1.5 text-[0.6875rem] leading-snug text-lp-faint">
                  EPUBCheck errors
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ---- The two ways in ----------------------------------------------------- */

function Badge({
  href,
  icon,
  over,
  label,
  primary = false,
}: {
  href: string;
  icon: keyof typeof PATHS;
  /** The caveat, on the quiet line — the half a bare pill has no room for. */
  over: string;
  label: string;
  primary?: boolean;
}) {
  return (
    <Link
      href={href}
      className={`flex items-center gap-3 rounded-2xl px-5 py-3 transition-colors ${
        primary
          ? "bg-lp-ground text-lp-ink hover:opacity-90"
          : "border border-lp-accent-ink/30 text-lp-accent-ink hover:border-lp-accent-ink/60"
      }`}
    >
      <Ico name={icon} size={22} className={primary ? "text-lp-accent-text" : ""} />
      <span className="text-left leading-tight">
        <span
          className={`block text-[0.6875rem] ${
            primary ? "text-lp-faint" : "text-lp-accent-pale"
          }`}
        >
          {over}
        </span>
        <span className="block text-[1.0625rem] font-semibold">{label}</span>
      </span>
    </Link>
  );
}

/* ---- The float furniture ------------------------------------------------- */

/**
 * The drawn cover, abstract on purpose.
 *
 * Shapes and title bars rather than lettering, for the reason `check-demo.tsx`
 * gives at more length: a figure on this page must carry neither a picture of
 * a book that does not exist nor a generated one. It is literal in both themes
 * — a cover is a picture of an object, and objects do not follow a setting.
 */
function Cover() {
  return (
    <svg viewBox="0 0 62 88" width={38} height={54} className="shrink-0 rounded-[2px] shadow-sm">
      <rect x="0" y="0" width="62" height="88" fill="#1e3a4c" />
      <circle cx="31" cy="49" r="8" fill="#e6b177" />
      <path d="M0 57 Q31 50 62 57 L62 88 L0 88 Z" fill="#142936" />
      <path d="M0 68 Q31 62 62 68 L62 88 L0 88 Z" fill="#0d1e29" />
      <rect x="11" y="13" width="40" height="3" rx="1.5" fill="#f1e8d8" opacity=".9" />
      <rect x="11" y="20" width="26" height="3" rx="1.5" fill="#f1e8d8" opacity=".55" />
    </svg>
  );
}

function Pill({
  tone,
  children,
}: {
  tone: "stop" | "note";
  children: React.ReactNode;
}) {
  /* Written out rather than built from `tone`: Tailwind reads class names as
     literals and ships no rule for one assembled at runtime. */
  const skin =
    tone === "stop"
      ? "bg-stop-bg text-stop-fg border-stop-line"
      : "bg-note-bg text-note-fg border-note-line";
  return (
    <span
      className={`rounded border px-1.5 py-0.5 text-[0.625rem] font-semibold ${skin}`}
    >
      {children}
    </span>
  );
}

function Tool({
  icon,
  label,
  lit = false,
}: {
  icon: keyof typeof PATHS;
  label: string;
  lit?: boolean;
}) {
  return (
    <span className="flex w-[3.75rem] flex-col items-center gap-1 rounded-xl px-1 py-1.5">
      <span
        className={`grid h-8 w-8 place-items-center rounded-full ${
          lit
            ? "bg-lp-accent text-lp-accent-ink"
            : "bg-lp-raised text-lp-body"
        }`}
      >
        <Ico name={icon} size={15} />
      </span>
      <span className="text-[0.625rem] text-lp-faint">{label}</span>
    </span>
  );
}

/* ---- The drawn screen ---------------------------------------------------- */

/**
 * The Overview, as it really is: findings first and worst first, the five
 * phase dials under them, then the next step on the road.
 *
 * That order is the argument the screen makes — what is wrong with the *book*,
 * then where you are on the *road* — so a figure that reordered it would be
 * selling a screen this app does not have. Nothing here is a score, a grade or
 * a percentage, for the same reason the real one has none.
 */
function Screen() {
  return (
    <div className="flex h-[30rem] text-lp-ink">
      {/* ---- The sidebar ------------------------------------------------ */}
      <aside className="flex w-44 shrink-0 flex-col border-r border-lp-line bg-lp-well px-3 py-3.5">
        <span className="px-2 text-[0.9375rem] font-bold tracking-tight">
          Open<span className="text-lp-wordmark">Chapter</span>
        </span>

        <nav className="mt-5 space-y-0.5">
          {AREAS.map((area, i) => (
            <span
              key={area.label}
              className={`flex items-center gap-2.5 rounded-lg px-2 py-[7px] text-[0.6875rem] ${
                i === 0
                  ? "bg-lp-raised font-semibold text-lp-accent-text"
                  : "font-medium text-lp-soft"
              }`}
            >
              <Ico name={area.icon} />
              {area.label}
            </span>
          ))}
        </nav>

        <span className="mt-auto flex items-center gap-2 rounded-lg border border-lp-edge px-2 py-2">
          <span className="grid h-6 w-6 place-items-center rounded-full bg-lp-raised text-[0.5625rem] font-bold text-lp-body">
            AN
          </span>
          <span className="text-[0.625rem] font-medium text-lp-soft">
            Your account
          </span>
        </span>
      </aside>

      {/* ---- The screen ------------------------------------------------- */}
      <div className="flex min-w-0 flex-1 flex-col">
        {/* The top bar, which is where the reference's two floating circles
            went. On a phone a search and a bell hover over the content; on a
            desktop they sit in the bar, and drawing them anywhere else would
            be drawing somebody else's platform. */}
        <div className="flex h-12 shrink-0 items-center gap-3 border-b border-lp-line px-4">
          <span className="text-[0.8125rem] font-semibold">The Salt Road</span>
          <span className="rounded border border-lp-edge px-1.5 py-0.5 text-[0.5625rem] font-medium text-lp-faint">
            Novel
          </span>
          <span className="ml-auto flex items-center gap-2 rounded-full border border-lp-edge bg-lp-well px-2.5 py-1.5 text-lp-faint">
            <Ico name="search" size={12} />
            <span className="text-[0.625rem]">Search the book</span>
          </span>
          <span className="grid h-7 w-7 place-items-center rounded-full border border-lp-edge text-lp-body">
            <Ico name="bell" size={13} />
          </span>
        </div>

        <div className="min-h-0 flex-1 px-4 py-3.5">
          {/* Two counts and real problems — never a score. The counts are of
              this drawn book, so they claim nothing about the product. */}
          <div className="flex items-baseline gap-4">
            <span className="text-[0.6875rem] font-semibold tracking-[0.12em] text-lp-faint uppercase">
              Overview
            </span>
            <span className="text-[0.6875rem] text-lp-faint">
              32 chapters · 88,140 words
            </span>
          </div>

          <p className="mt-2 font-serif text-[0.9375rem] font-semibold">
            Five things stand between this book and a shop.
          </p>

          <ul className="mt-2.5 space-y-1.5">
            {FINDINGS.map((finding) => (
              <li
                key={finding.text}
                className={`flex items-center gap-2.5 rounded-lg border px-3 py-2 ${
                  finding.tone === "stop"
                    ? "border-stop-line bg-stop-bg"
                    : "border-note-line bg-note-bg"
                }`}
              >
                <span
                  className={`h-1.5 w-1.5 shrink-0 rounded-full ${
                    finding.tone === "stop" ? "bg-stop-fg" : "bg-note-fg"
                  }`}
                />
                <span
                  className={`min-w-0 flex-1 truncate text-[0.6875rem] ${
                    finding.tone === "stop" ? "text-stop-fg" : "text-note-fg"
                  }`}
                >
                  {finding.text}
                </span>
                {/* The control that fixes it, on the problem. Indigo inside a
                    red card on purpose: it is the way *out* of the problem,
                    and a red button would say pressing it is the dangerous
                    part. The real dashboard makes the same choice. */}
                <span className="shrink-0 rounded-md bg-lp-accent px-2 py-1 text-[0.625rem] font-semibold text-lp-accent-ink">
                  {finding.action}
                </span>
              </li>
            ))}
          </ul>

          {/* The five phases, under the findings rather than beside them:
              what is wrong with the book, then where you are on the road.
              Labels read from `PHASES`. */}
          <div className="mt-4 rounded-xl border border-lp-edge p-3">
            <div className="flex items-start">
              {PHASES.map((phase, i) => (
                <div
                  key={phase.id}
                  className="flex min-w-0 flex-1 flex-col items-center gap-1.5"
                >
                  <Dial lit={i === 2} filled={i < 2} />
                  <span
                    className={`truncate text-[0.5625rem] ${
                      i === 2 ? "font-semibold text-lp-ink" : "text-lp-faint"
                    }`}
                  >
                    {phase.label}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* The next step — cut by the section's bottom edge, which is where
              the crop was aimed. Read from `STEPS` so it is a real one. */}
          {NEXT_STEP && (
            <div className="mt-2.5 flex items-center gap-3 rounded-xl border border-lp-edge bg-lp-well px-3 py-2.5">
              <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full border border-lp-edge text-[0.5625rem] font-bold text-lp-faint">
                {STEPS.indexOf(NEXT_STEP) + 1}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[0.6875rem] font-semibold">
                  {NEXT_STEP.title}
                </span>
                <span className="block truncate text-[0.625rem] text-lp-faint">
                  {NEXT_STEP.note}
                </span>
              </span>
              <span className="shrink-0 text-lp-faint">
                <Ico name="arrow" size={14} />
              </span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/** One phase dial. Empty, part-filled or lit — never a percentage. */
function Dial({ lit, filled }: { lit: boolean; filled: boolean }) {
  const c = 2 * Math.PI * 8.2;
  return (
    <svg viewBox="0 0 22 22" width={20} height={20} className="block">
      <circle
        cx="11"
        cy="11"
        r="8.2"
        fill="none"
        stroke="var(--color-lp-edge)"
        strokeWidth="2"
      />
      {(filled || lit) && (
        <circle
          cx="11"
          cy="11"
          r="8.2"
          fill="none"
          stroke="var(--color-lp-accent-text)"
          strokeWidth="2"
          strokeLinecap="round"
          strokeDasharray={`${c * (filled ? 1 : 0.3)} ${c}`}
          transform="rotate(-90 11 11)"
        />
      )}
    </svg>
  );
}
