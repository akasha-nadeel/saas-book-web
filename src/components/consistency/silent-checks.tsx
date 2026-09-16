"use client";

/**
 * What the checks that came back with nothing were looking for.
 *
 * **The explanation existed and was unreachable.** Every check carries a written
 * note — `NAME_NOTE`, `QUOTE_NOTE`, `UNCLOSED_NOTE` and the rest in
 * `consistency.ts` — and every one of them is attached to a *finding*, so it is
 * drawn only when something was found and is missing in the one case where the
 * writer is asking a question. A writer who typed `kamal` three times and
 * `camal` once ran the name check, read "Nothing came back", and had no way on
 * screen to learn that the check reads capitalised words only.
 *
 * It is the house rule as much as a kindness: an empty result is never rendered
 * as a good one, and has to carry the provenance of the search that produced it.
 * Naming what each silent check looked for *is* that provenance.
 *
 * **One component for both surfaces**, for the reason `consistency-checks.ts`
 * itself exists. The page and the panel already word their empty states
 * differently — "That is not praise…" against "not a verdict on the book" — and
 * a second copy of this would drift the same way inside a month.
 *
 * **No `dense` flag and no second variant.** The panel forbids one, and nothing
 * here needs it: the rows are a grouped list, which is as happy at 240px as at
 * the page's full measure.
 */

import { CHECK_LOOK } from "@/lib/consistency-checks";
import { CheckMark } from "@/components/consistency/check-marks";
import {
  silentChecks,
  type CheckId,
  type ConsistencyReport,
} from "@/lib/consistency";
import { ListGroup, SectionHeader } from "@/components/ui/list";
import { plural } from "@/lib/plural";

/**
 * The block, in whichever of its two shapes fits what came back.
 *
 * Give it the **plan-filtered** report (`reportForPlan`), never the raw one, or
 * a free writer is told a Pro check was silent when it was only withheld.
 */
export function SilentChecks({ report }: { report: ConsistencyReport }) {
  const silent = silentChecks(report);
  // Nothing ran, or every check that ran found something. Either way there is
  // no silence to explain, and a heading over an empty list is worse than none.
  if (report.ran.length === 0 || silent.length === 0) return null;

  /*
   * Nothing at all came back, so this *is* the result and stands open.
   *
   * With findings above it the same block is a footnote to them, and a footnote
   * that arrives already unrolled pushes the thing the writer came for off the
   * screen — so it folds behind one press instead.
   */
  const allQuiet = report.findings.length === 0;

  const rows = (
    /* **No rules between the rows.** One container and space, rather than a
       hairline at every join: each row is a mark, a name and two short
       paragraphs, and at that height a rule every few lines reads as a table of
       contents. The group's own border and radius stay — it is still one block,
       not eleven.

       `divide-y-0` over `ListGroup`'s own `divide-y` is settled by the
       stylesheet, not by the class list, so it was checked rather than assumed:
       Tailwind emits the bare utility before its `-0` value, which is the same
       ordering `p-4 pt-2` relies on. */
    <ListGroup as="ul" className="mt-0.5 gap-1 divide-y-0 p-1.5">
      {silent.map((id) => (
        <li key={id}>
          <CheckNote id={id} />
        </li>
      ))}
    </ListGroup>
  );

  if (allQuiet) {
    return (
      <section className="mt-5">
        <SectionHeader>What was looked for</SectionHeader>
        {rows}
      </section>
    );
  }

  return (
    <details className="group/all mt-5">
      <summary className="cursor-pointer list-none">
        <SectionHeader
          trailing={
            <>
              <span className="group-open/all:hidden">Show</span>
              <span className="hidden group-open/all:inline">Hide</span>
            </>
          }
        >
          What the other {plural(silent.length, "check")} looked for
        </SectionHeader>
      </summary>
      {rows}
    </details>
  );
}

/**
 * One check: its mark, its name, what it looks for and what it leaves alone.
 *
 * **Nothing folds.** Both lines are drawn, because a writer reading this block
 * has already been told "nothing came back" and the follow-up question is
 * always the second one — *why was mine not caught* — and a question you have
 * to press for is a question most people leave unasked. The block as a whole
 * still folds when there are findings above it; a row does not.
 *
 * `<div>` rather than a button: there is nothing to press, so there is nothing
 * to announce as pressable.
 */
function CheckNote({ id }: { id: CheckId }) {
  const look = CHECK_LOOK[id];

  return (
    <div className="flex items-start gap-3 rounded-[10px] px-2.5 py-2.5">
      <CheckMark id={id} size="md" />

      <div className="min-w-0 flex-1">
        <p className="text-[13px] leading-snug font-semibold text-fg">
          {look.name}
        </p>
        <p className="mt-1 text-xs leading-relaxed text-muted">
          {look.looksFor}
        </p>
        <p className="mt-2 text-[11px] font-semibold tracking-wide text-muted uppercase">
          Won&rsquo;t count
        </p>
        <p className="mt-0.5 text-xs leading-relaxed text-muted">
          {look.ignores}
        </p>
      </div>
    </div>
  );
}
