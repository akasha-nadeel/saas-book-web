import Link from "next/link";
import { ToolMark } from "@/components/shelf/tool-marks";
import { TOOL_GROUPS } from "@/lib/book-tools";

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
        <section key={group.title} className="mb-6 last:mb-0">
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
          <div className="mt-3 grid grid-cols-3 overflow-hidden rounded-xl border border-line sm:grid-cols-4 lg:grid-cols-5">
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
      ))}
    </>
  );
}
