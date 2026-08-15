"use client";

import {
  MATTER_SECTIONS,
  type MatterPart,
  type MatterSection,
} from "@/lib/matter";
import { matterKey } from "@/lib/matter-picks";

/**
 * The offered pages at one end of the book, as a list of tickable rows.
 *
 * Shared by the two screens that put this question — the setup dialog for a
 * book that arrived some other way, and steps two and three of `/book/new`.
 * The rows carry the *explanations*, which is the whole reason this is a list
 * of labelled choices rather than two Start buttons: "Epigraph" means nothing
 * to a first novelist, and sixteen of those is sixteen guesses.
 */
export function MatterPartRows({
  part,
  picked,
  onToggle,
}: {
  part: MatterPart;
  picked: ReadonlySet<string>;
  onToggle: (key: string) => void;
}) {
  return (
    <div className="flex flex-col gap-0.5">
      {MATTER_SECTIONS[part].map((section) => (
        <SectionRow
          key={section.title}
          section={section}
          on={picked.has(matterKey(part, section.title))}
          onToggle={() => onToggle(matterKey(part, section.title))}
        />
      ))}
    </div>
  );
}

/**
 * One offered page.
 *
 * **The "Usually" marker rather than two groups behind a disclosure.** The
 * problem with the flat list was never its length — eight rows a column is
 * nothing to scan — it was that sixteen identical rows read as a checklist to
 * complete. Splitting them into "Usually included" and an "Optional" section
 * folded away would have fixed that by *hiding* thirteen real choices behind a
 * click, which is the wrong trade: a writer who wants a prologue should not
 * have to go looking for it, and progressive disclosure earns its keep on long
 * lists rather than on short ones with an uneven distribution.
 *
 * So the rows stay where they are and three of them are marked. The eye lands
 * on the few most books have, everything else is one glance away, and nothing
 * is hidden.
 */
function SectionRow({
  section,
  on,
  onToggle,
}: {
  section: MatterSection;
  on: boolean;
  onToggle: () => void;
}) {
  return (
    /* Tighter than it was: `py-2` and a `text-xs` hint on relaxed leading made
       each row about 70px, so sixteen of them ran to 1,100px and the list was
       mostly scrollbar on a laptop. The hint is the same size on tighter
       leading and the padding is down a step, which fits four more rows in the
       same window without making anything harder to read or to hit — the row
       is still a comfortable target because the whole label is one. */
    <label
      className={`flex cursor-pointer gap-2.5 rounded-lg border px-2.5 py-1.5
                  transition-colors ${
                    on
                      ? "border-accent/60 bg-raised"
                      : "border-transparent hover:bg-raised"
                  }`}
    >
      {/* **A real checkbox, drawn rather than left to the browser.** It is
          still an `<input type="checkbox">` — that is what a keyboard and a
          screen reader already know how to work, and there are sixteen of them
          — but `accent-color` only ever colours the *ticked* box, and the
          unticked one was left to the user agent. That came out as a filled
          charcoal square: the same weight as a ticked one, on a screen whose
          only job is telling ticked from unticked at a glance.

          So `appearance-none` and two explicit states. Unticked is the page's
          own `raised` grey behind an `fg` hairline — near-black on white and
          near-white on black, so "a light box with a thin dark edge" survives
          the theme rather than being a daylight-only design. Ticked is the
          accent fill with an `accent-ink` tick over it, which is the pair used
          for every filled control in the chrome: the fill inverts between
          themes and a literal white tick would vanish in exactly one of
          them. */}
      <span className="relative mt-[3px] flex h-4 w-4 shrink-0">
        <input
          type="checkbox"
          checked={on}
          onChange={onToggle}
          className="peer h-4 w-4 cursor-pointer appearance-none rounded-sm border
                     border-fg bg-raised outline-none transition-colors
                     checked:border-accent checked:bg-accent
                     focus-visible:ring-2 focus-visible:ring-accent/60"
        />
        <svg
          aria-hidden="true"
          viewBox="0 0 16 16"
          className="pointer-events-none absolute inset-0 hidden h-4 w-4
                     text-accent-ink peer-checked:block"
        >
          <path
            d="M3.5 8.5l3 3 6-6.5"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </span>
      <span className="min-w-0">
        <span className="flex flex-wrap items-baseline gap-x-2">
          <span className="font-sans text-sm font-medium text-fg">
            {section.title}
          </span>
          {/* **A blue badge, in the palette's own blue.**
              `--color-badge-blue-*` is the set the pricing table and the
              shared-book badge already wear, borrowed rather than a new blue
              invented: it is stated in both theme blocks and already measured
              (6.4:1 by day, 10:1 at night), and a second blue three shades off
              the first is how a palette starts lying.

              It is the right *family* for this word too. Blue here is a
              state — "most books have this one" — where the `note` amber
              would read as a warning and `ok` green as something already
              done. It is a note about convention rather than a
              recommendation, and it sits beside the title rather than
              replacing the hint, because "what is this page" is still the
              question a first novelist is asking.

              `rounded` rather than a capsule: a full pill is a *control* in
              this app, and a label you cannot press should not borrow the
              shape of one. */}
          {section.usual && (
            <span
              className="rounded border border-badge-blue-line bg-badge-blue-bg
                         px-1.5 py-px font-sans text-[10px] font-semibold
                         tracking-wide text-badge-blue-ink uppercase"
            >
              Usually
            </span>
          )}
        </span>
        <span className="block font-sans text-xs leading-tight text-muted">
          {section.hint}
        </span>
      </span>
    </label>
  );
}
