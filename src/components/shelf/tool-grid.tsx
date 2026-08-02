import Link from "next/link";
import { ToolMark } from "@/components/shelf/tool-marks";
import { TOOL_GROUPS, type ToolGroup } from "@/lib/book-tools";

/**
 * How many columns a block of tools is laid out in.
 *
 * A prop rather than something worked out from `tools.length`, because Tailwind
 * reads class names as literals and would ship no rule for one built at
 * runtime. Two callers, two honest answers: the Tools area is a catalogue and
 * fills the width it is given, while a group standing on its own inside a card
 * wants a column per tool — a five-wide grid holding three tools leaves two
 * empty ruled cells, which read as tools that failed to load.
 */
const COLUMNS = {
  fill: "grid-cols-3 sm:grid-cols-4 lg:grid-cols-5",
  three: "grid-cols-3",
} as const;

/**
 * One group of tools: heading, note, and a ruled block of marks.
 *
 * Exported because the Overview borrows a single group — the three tools that
 * get a finished book out — and the alternative was a second copy of this
 * markup on the dashboard. `book-tools.ts` exists so the *descriptions* live
 * once; this is the same argument applied to the drawing of them.
 */
export function ToolGroupBlock({
  group,
  bookId,
  onPick,
  columns = "fill",
}: {
  group: ToolGroup;
  bookId: string;
  /** Called on navigation, so a sheet can shut itself. */
  onPick?: () => void;
  columns?: keyof typeof COLUMNS;
}) {
  return (
    <section>
      <h3 className="text-xs font-bold tracking-widest text-fg uppercase">
        {group.title}
      </h3>
      <p className="mt-1 text-xs text-muted">{group.note}</p>

      {/* Ruled, like a table. The lines are what make a wall of marks read
          as a catalogue rather than as scattered buttons, and they give
          each cell an edge to light up on hover.

          Every cell carries a full border and is pulled a pixel back, so
          neighbouring borders collapse into one line — rather than putting
          the rule on two sides and leaving a partial last row with a
          missing edge, which is what happens when a group's count does not
          divide by the column count. Three of these four groups do not. */}
      <div
        className={`mt-3 grid overflow-hidden rounded-xl border border-line ${COLUMNS[columns]}`}
      >
        {group.tools.map((tool) => (
          <Link
            key={tool.path}
            href={`/book/${bookId}/${tool.path}`}
            onClick={onPick}
            title={tool.what}
            className="group -mt-px -ml-px flex flex-col items-center gap-2 border
                       border-line px-2 py-4 text-center transition-colors
                       hover:bg-raised"
          >
            <ToolMark name={tool.icon} />
            <span className="text-xs leading-snug font-medium text-fg">
              {tool.name}
            </span>
          </Link>
        ))}
      </div>
    </section>
  );
}

/**
 * The fifteen per-book tools, pointed at one book.
 *
 * A grid of marks with a name under each, the shape every integrations page
 * uses, because it is the shape that answers the question this screen is asked:
 * *what is in here?* The cards it replaced carried a sentence of explanation
 * apiece, which made the same fifteen tools four screens tall and turned a
 * glance into a read.
 *
 * **The explanations are not deleted, they are on the hover.** Each tile
 * carries its sentence as a `title`, so the answer to "what is Comps?" is a
 * pause away rather than gone — and `book-tools.ts` still holds all fifteen in
 * one place, which is where they can be checked against what the product
 * actually does.
 *
 * Shared by the sheet a book card opens and the dashboard's Tools area, which
 * show the same list from two entry points — one where the book is already
 * chosen, one where it has just been picked.
 *
 * **The groups were told apart by hue and now are not**, because the palette is
 * greyscale. What separates them instead is what was always doing most of the
 * work: a heading, a line of note under it, and a ruled block of its own. Four
 * greys on four headings was the other option and is worse — differing values
 * on the same kind of label read as differing *importance*, which is a claim
 * none of these groups is making about the others.
 */

export function ToolGrid({
  bookId,
  onPick,
}: {
  bookId: string;
  /** Called on navigation, so a sheet can shut itself. */
  onPick?: () => void;
}) {
  return (
    <>
      {TOOL_GROUPS.map((group) => (
        <div key={group.title} className="mb-6 last:mb-0">
          <ToolGroupBlock group={group} bookId={bookId} onPick={onPick} />
        </div>
      ))}
    </>
  );
}
