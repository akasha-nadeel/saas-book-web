import type { EntryKind } from "@/lib/bible";
import { KindMark } from "./kind-marks";

/**
 * One entry in the bible's gallery.
 *
 * **A card, where the rest of the editor's panels use grouped rows**, and the
 * reason is recorded in `docs/styling.md` (amendment of 2026-09-27): an entry
 * is a small document — a name, what else they are called, a description,
 * what they are tied to — and a gallery of them is read like a box of index
 * cards, two to a row, rather than scanned like a list of peers.
 *
 * **Neutral, and the same grey and hairline as `ListGroup`.** The kind's hue is
 * on the mark alone; a washed ground per kind would put seven competing card
 * colours down one column, which is the pile the panel rules exist to prevent.
 *
 * The whole card is the one control, the way a tile is on iOS: a card with a
 * small "open" link inside it is a large target that does nothing and a small
 * one that does.
 */
export function EntryCard({
  id,
  kind,
  name,
  aka,
  detail,
  connections,
  from,
  onOpen,
}: {
  /** So focus can come back here when the entry's page is closed. */
  id: string;
  kind: EntryKind;
  name: string;
  aka: readonly string[];
  detail: string;
  connections: number;
  /** The book it was first written down in, when that is not this one. */
  from: string | null;
  onOpen: () => void;
}) {
  return (
    <button
      id={id}
      type="button"
      onClick={onOpen}
      className="flex h-full min-h-[7.5rem] w-full flex-col rounded-2xl border border-line
                 bg-raised/40 p-3 text-left font-sans outline-none transition-colors
                 hover:bg-raised focus-visible:ring-2 focus-visible:ring-accent/60"
    >
      <KindMark kind={kind} size="sm" />

      <span className="mt-2.5 line-clamp-2 text-[14px] leading-snug font-semibold text-fg">
        {name}
      </span>
      {aka.length > 0 && (
        <span className="mt-0.5 truncate text-[11px] text-muted">
          {aka.join(", ")}
        </span>
      )}
      {detail && (
        <span className="mt-1.5 line-clamp-3 text-[12px] leading-relaxed whitespace-pre-line text-muted">
          {detail}
        </span>
      )}

      {(connections > 0 || from) && (
        <span className="mt-auto flex items-center gap-2 pt-2.5 text-[11px] text-muted tabular-nums">
          {connections > 0 && (
            <span className="flex items-center gap-1">
              <LinkGlyph />
              {connections}
              <span className="sr-only">
                {connections === 1 ? " connection" : " connections"}
              </span>
            </span>
          )}
          {from && <span className="min-w-0 truncate">{from}</span>}
        </span>
      )}
    </button>
  );
}

/** Two links of a chain, on the 24 grid like everything else in the rail. */
function LinkGlyph() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      className="h-3 w-3"
    >
      <path d="M10 14a4 4 0 0 0 5.66 0l3-3a4 4 0 0 0-5.66-5.66l-1 1" />
      <path d="M14 10a4 4 0 0 0-5.66 0l-3 3a4 4 0 0 0 5.66 5.66l1-1" />
    </svg>
  );
}
