"use client";

import { Menu, MenuButton, MenuLabel } from "@/components/ui/menu";
import { shelfIcons } from "@/components/shelf/shelf-icons";
import { SHELF_LAYOUTS, type ShelfLayout } from "@/lib/shelf-layout";

/**
 * "View ⌄" — which of the four ways a wall of books is drawn.
 *
 * **A menu, not a row of icon buttons.** Four modes is past what an unlabelled
 * icon strip can carry: "small covers" and "list" are the same two lines to
 * anybody who has not learned the set. A menu names each one and ticks the
 * current. Windows Explorer's View, in shape — not in length; its eight modes
 * are a menu that accumulated rather than one that was decided.
 *
 * **Here on the third call site.** The shelf drew this inline; the comps wall
 * and the title check's matches now want the same control over the same four
 * modes, and three hand-rolled copies is how one of them ends up with a radius
 * the others do not have and a tick on the wrong side. `ui/` is deliberately
 * narrow and things land in it on the third copy — this is the third.
 *
 * **The heading is optional, and the searches leave it off.** On the shelf
 * "Show books as" earns its line: that menu sits in a bar beside a sort control
 * and a bulk-select toggle, so the rows under it need saying what they are
 * about. Over a wall of search results the trigger already says *View*, the
 * four entries are self-evidently four ways of drawing books, and a heading
 * repeating that is a line of shouting caps in a four-row menu. The modes,
 * their words and their order are `SHELF_LAYOUTS` in every case, so the app has
 * one idea of what a view is and a writer learns it once.
 *
 * What each mode *means* is the caller's business — `gridClassFor` for the
 * shelf's viewport grid, `resultsGridClass` for a search's container-query one.
 * This control only ever answers which.
 */
export function ViewMenu({
  value,
  onChange,
  label,
  align = "end",
}: {
  value: ShelfLayout;
  onChange: (next: ShelfLayout) => void;
  /**
   * The menu's own heading — what is being shown, not the control.
   *
   * Left off entirely rather than defaulted, so a caller that wants no heading
   * says so by saying nothing. See the note above for which do and why.
   */
  label?: string;
  align?: "start" | "end";
}) {
  return (
    <Menu
      label="View"
      align={align}
      width={220}
      triggerClassName="flex shrink-0 items-center gap-1.5 rounded-lg border
                        border-line bg-panel px-3 py-1.5 text-sm text-muted
                        transition-colors hover:bg-raised hover:text-fg
                        focus-visible:outline-none focus-visible:ring-2
                        focus-visible:ring-accent/50"
      trigger={
        <>
          <span className="[&>svg]:h-4 [&>svg]:w-4">{shelfIcons.tools}</span>
          View
          <span className="[&>svg]:h-4 [&>svg]:w-4">{shelfIcons.chevron}</span>
        </>
      }
    >
      {(close) => (
        <>
          {label && <MenuLabel>{label}</MenuLabel>}
          {SHELF_LAYOUTS.map((option) => (
            <MenuButton
              key={option.id}
              /* The tick on the right, as the book picker does it — the left
                 slot stays empty on every row so the labels line up whichever
                 one is current. */
              badge={option.id === value ? shelfIcons.check : undefined}
              onClick={() => {
                onChange(option.id);
                close();
              }}
            >
              {option.label}
            </MenuButton>
          ))}
        </>
      )}
    </Menu>
  );
}
