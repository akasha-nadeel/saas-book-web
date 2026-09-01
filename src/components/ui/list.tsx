/**
 * The inset grouped list — the shape most of the editor's panels want.
 *
 * **Every panel in the editor renders N separately-bordered cards in a gap-2
 * column**, and that is the single thing that makes a 240px rail look like a
 * pile rather than a screen: eight versions is eight boxes, six findings is six
 * boxes, and each one is competing with the next for the same hairline. The
 * grouped list is the answer every list on iOS uses — *one* container, hairline
 * separators between its rows, and the label that names it sitting **outside**
 * in small quiet type.
 *
 * ```
 *   VERSIONS                    8      ← SectionHeader, outside
 *   ┌──────────────────────────────┐
 *   │ 12 minutes ago      2,140 w  │   ← ListRow
 *   ├──────────────────────────────┤   ← the divider is the group's, not
 *   │ an hour ago         2,090 w  │      the row's
 *   └──────────────────────────────┘
 *   Kept about every ten minutes.      ← ListFooter
 * ```
 *
 * **The footer is not decoration.** iOS puts explanatory text *below* the rows
 * it explains, and the reason is worth keeping: a paragraph above a list is
 * read once and then read past forever, where the same words below are found by
 * the person who went looking. Several panels here open on two paragraphs of
 * explanation before the writer reaches the thing they came for.
 *
 * **No `"use client"`, and that is not the same as being a Server Component.**
 * Nothing here holds state or an effect — a row that needs a handler takes one
 * from a caller that has already declared the directive. See
 * `assistant-reply.tsx`, which documents the same arrangement.
 */

/**
 * The label above a group.
 *
 * Uppercase at 11px, which is Apple's own treatment and is doing a job rather
 * than a style: a section header has to be legible without competing with the
 * rows under it, and at this size weight and letter-spacing carry it where a
 * larger size would make it a heading.
 */
export function SectionHeader({
  children,
  trailing,
  className = "",
}: {
  children: React.ReactNode;
  /** A count, usually. Sits at the far end of the header's own line. */
  trailing?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={`flex items-center gap-2 px-1 pb-1.5 ${className}`}>
      <span className="min-w-0 flex-1 truncate text-[11px] font-semibold tracking-wide text-muted uppercase">
        {children}
      </span>
      {trailing !== undefined && (
        <span className="shrink-0 text-[11px] font-semibold text-muted tabular-nums">
          {trailing}
        </span>
      )}
    </div>
  );
}

/**
 * The container. One border, one radius, and the separators between its rows.
 *
 * `overflow-hidden` so the first and last rows are clipped to the radius —
 * without it a row's own hover fill squares off the corners, which is the
 * detail that makes a grouped list look drawn rather than assembled.
 *
 * `divide-y` rather than a border on each row: a border per row double-draws at
 * every join and leaves a stray rule under the last one.
 */
export function ListGroup({
  children,
  as: Tag = "div",
  className = "",
}: {
  children: React.ReactNode;
  /**
   * `ul` when the rows are genuinely a list of things.
   *
   * Not cosmetic: a screen reader announces "list, 6 items" for a set of
   * findings and nothing at all for six divs, and the findings are the case
   * this was added for. The styling is identical either way.
   */
  as?: "div" | "ul";
  className?: string;
}) {
  return (
    <Tag
      className={`flex flex-col divide-y divide-line overflow-hidden rounded-xl
                  border border-line bg-raised/40 ${className}`}
    >
      {children}
    </Tag>
  );
}

/**
 * One row.
 *
 * Renders as a `<button>` when it has an `onClick` and a `<div>` otherwise —
 * because a row that does nothing should not be in the tab order, and a row
 * that does something should be reachable from a keyboard without a caller
 * having to remember either fact.
 *
 * **`leading` is where a category's colour goes.** The consistency panel used
 * to wash each card with the hue of its check; a glyph carries the same
 * information without six competing backgrounds, which is how Settings tells
 * one category from another.
 */
export function ListRow({
  leading,
  title,
  detail,
  trailing,
  active = false,
  onClick,
  onPointerDown,
  disabled,
  id,
  className = "",
  children,
}: {
  leading?: React.ReactNode;
  title?: React.ReactNode;
  /** The second line, in footnote size. */
  detail?: React.ReactNode;
  trailing?: React.ReactNode;
  active?: boolean;
  onClick?: (event: React.MouseEvent) => void;
  onPointerDown?: (event: React.PointerEvent) => void;
  disabled?: boolean;
  id?: string;
  className?: string;
  /** Free content instead of the title/detail pair, for a row that is neither. */
  children?: React.ReactNode;
}) {
  const inner = (
    <>
      {leading !== undefined && <span className="shrink-0">{leading}</span>}
      <span className="min-w-0 flex-1">
        {children ?? (
          <>
            {title !== undefined && (
              <span className="block truncate text-[13px] text-fg">{title}</span>
            )}
            {detail !== undefined && (
              <span className="mt-0.5 block text-[11px] leading-relaxed text-muted">
                {detail}
              </span>
            )}
          </>
        )}
      </span>
      {trailing !== undefined && <span className="shrink-0">{trailing}</span>}
    </>
  );

  const shared = `flex w-full items-center gap-2.5 px-3.5 py-2.5 text-left ${
    active ? "bg-accent/10" : ""
  } ${className}`;

  if (!onClick) {
    return <div className={shared}>{inner}</div>;
  }

  return (
    <button
      id={id}
      type="button"
      onClick={onClick}
      onPointerDown={onPointerDown}
      disabled={disabled}
      className={`${shared} outline-none transition-colors
                  focus-visible:ring-2 focus-visible:ring-accent/60 focus-visible:ring-inset
                  disabled:pointer-events-none disabled:opacity-40 ${
                    active ? "" : "hover:bg-raised"
                  }`}
    >
      {inner}
    </button>
  );
}

/**
 * The sentence under a group.
 *
 * Footnote size and muted, with the group's own inset — so it reads as a note
 * about the list rather than as the next thing in the column.
 */
export function ListFooter({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <p
      className={`px-1 pt-1.5 text-[11px] leading-relaxed text-muted ${className}`}
    >
      {children}
    </p>
  );
}

/**
 * The small tinted action that sits at the end of a row.
 *
 * Apple's inline row action: the accent as *type on a tint* rather than as a
 * filled button, because a row is not the place for the weight of a primary
 * press — the screen usually has eight of them.
 */
export function RowAction({
  children,
  onClick,
  disabled,
  label,
}: {
  children: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
  label?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      className="rounded-[7px] bg-accent/10 px-2.5 py-1 text-[11px] font-semibold
                 text-accent outline-none transition-colors hover:bg-accent/20
                 focus-visible:ring-2 focus-visible:ring-accent/60
                 disabled:pointer-events-none disabled:opacity-40"
    >
      {children}
    </button>
  );
}
