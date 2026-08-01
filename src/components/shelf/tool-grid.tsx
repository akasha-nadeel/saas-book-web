import Link from "next/link";
import { TOOL_GROUPS } from "@/lib/book-tools";

/**
 * The fifteen per-book tools, grouped and explained, pointed at one book.
 *
 * Shared by the sheet a book card opens and the dashboard's Tools area, which
 * show the same list from two entry points — one where the book is already
 * chosen, one where it has just been picked. Keeping it in a single component
 * means the two cannot drift apart in layout the way they were about to drift
 * apart in wording.
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
          <h3 className="text-xs font-bold tracking-widest text-muted uppercase">
            {group.title}
          </h3>
          <p className="mt-1 text-xs text-muted">{group.note}</p>
          <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {group.tools.map((tool) => (
              <Link
                key={tool.path}
                href={`/book/${bookId}/${tool.path}`}
                onClick={onPick}
                className="rounded-xl border border-line bg-surface p-3
                           transition-colors hover:border-accent/40"
              >
                <span className="block text-sm font-bold text-fg">
                  {tool.name}
                </span>
                <span className="mt-0.5 block text-xs leading-relaxed text-muted">
                  {tool.what}
                </span>
              </Link>
            ))}
          </div>
        </section>
      ))}
    </>
  );
}
