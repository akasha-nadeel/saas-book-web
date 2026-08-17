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
 * folded away would have fixed that by *hiding* real choices behind a click,
 * which is the wrong trade: a writer who wants a prologue should not have to go
 * looking for it, and progressive disclosure earns its keep on long lists
 * rather than on short ones with an uneven distribution.
 *
 * So the rows stay where they are and the usual ones are marked. The eye lands
 * on the few most books have, everything else is one glance away, and nothing
 * is hidden.
 *
 * **Every row ticks freely, including the three the export builds.** Two
 * louder shapes were tried on those three and both came off: a blue line under
 * the hint reading "We build this if you skip it.", which sat there whether or
 * not anybody was thinking about the row, and then a dialog on the tick, which
 * put a decision in front of a writer who had already made one. Ticking a box
 * is cheap and reversible, the page is deletable, and the export sorts out the
 * clash later and says so at the time. A checkbox that argues back is worse
 * than a page nobody wanted.
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
          {/* **A filled green lozenge, not a tint like the family's others.**

              `--color-badge-new-*` is the one badge in the palette that is a
              fill: solid green carrying white, stated identically in both
              theme blocks the way `--color-upgrade-*` is, because a saturated
              mid-tone reads on either ground. It was the pale blue tint the
              pricing table wears, and a tint is a *label* treatment — right
              on a table of values, too quiet here, where sixteen
              near-identical checkbox rows mean the marker's whole job is to be
              found without reading.

              It says a book usually *has* this page. On the three rows the
              export builds it sits beside the blue line saying we make it, and
              the two halves are deliberately different colours: one is a fact
              about books, the other is a fact about this app.

              `rounded-md` rather than a capsule: a full pill is a *control* in
              this app, and a label you cannot press should not borrow the
              shape of one. */}
          {section.usual && (
            <span
              className="rounded-md bg-badge-new-bg px-1.5 py-0.5 font-sans
                         text-[10px] font-bold tracking-wide text-badge-new-ink
                         uppercase"
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
