import Link from "next/link";
import { ToolMark } from "@/components/shelf/tool-marks";
import { TOOL_GROUPS, type ToolTone } from "@/lib/book-tools";

/**
 * The fifteen per-book tools, grouped and explained, pointed at one book.
 *
 * Shared by the sheet a book card opens and the dashboard's Tools area, which
 * show the same list from two entry points — one where the book is already
 * chosen, one where it has just been picked. Keeping it in a single component
 * means the two cannot drift apart in layout the way they were about to drift
 * apart in wording.
 *
 * **Every tool has a mark of its own**, drawn in `tool-marks.tsx` the way a
 * product logo is: solid shapes, its own colours, a silhouette you could name
 * with the label covered. The uniform stroke icons this replaced read as
 * interface furniture — one weight, one hue, fifteen of them — so the page had
 * to be read top to bottom every time.
 *
 * The group keeps its hue on the *heading*, not on the cards. Colour on both
 * would flatten fifteen products back into four blocks, which is the thing the
 * marks are there to undo.
 */

const HEADS: Record<ToolTone, string> = {
  blue: "text-blue-700",
  violet: "text-violet-700",
  emerald: "text-emerald-700",
  amber: "text-amber-700",
};

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
        <section key={group.title} className="mb-7 last:mb-0">
          <h3
            className={`text-xs font-bold tracking-widest uppercase ${HEADS[group.tone]}`}
          >
            {group.title}
          </h3>
          <p className="mt-1 text-xs text-muted">{group.note}</p>
          <div className="mt-3 grid gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
            {group.tools.map((tool) => (
              <Link
                key={tool.path}
                href={`/book/${bookId}/${tool.path}`}
                onClick={onPick}
                className="flex gap-3 rounded-xl border border-line bg-surface p-3.5
                           transition-colors hover:border-accent/40"
              >
                <ToolMark name={tool.icon} />
                <span className="min-w-0">
                  <span className="block text-sm font-bold text-fg">
                    {tool.name}
                  </span>
                  <span className="mt-0.5 block text-xs leading-relaxed text-muted">
                    {tool.what}
                  </span>
                </span>
              </Link>
            ))}
          </div>
        </section>
      ))}
    </>
  );
}
