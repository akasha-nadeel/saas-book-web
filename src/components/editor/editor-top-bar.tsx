"use client";

import Link from "next/link";
import { Menu, MenuButton, MenuLink, MenuSeparator } from "@/components/ui/menu";
import { Tooltip } from "@/components/ui/tooltip";
import { shelfIcons } from "@/components/shelf/shelf-icons";
import { RailMark, useMarkHandle } from "@/components/editor/rail-mark";
import { icons } from "@/components/editor/icon-rail";

/**
 * The editor's application bar.
 *
 * **The editor had no header at all.** What a word processor puts along the
 * top — where you are, what the file is called, whether it is saved, and the
 * actions that act on the whole document rather than on a paragraph — was
 * spread between two icon rails and a thin strip that only said the word
 * count. So the answer to "what am I working on" was the running head on the
 * page itself, and the answer to "is this saved" was a word at the end of a
 * row of controls.
 *
 * Three groups, and the grouping is the argument:
 *
 * - **Left is the document**: the way out to the shelf, the file-level menu,
 *   the two history controls, and whether the work is safe. Everything here is
 *   about the manuscript as a *file*.
 * - **Centre is what it is** — the book, and the chapter open in it. It is the
 *   one thing on this bar that is not a control.
 * - **Right is getting it out**: bringing a manuscript in, and taking one away.
 *   Export is the filled button because it is the end of the road and the thing
 *   the product is finally for; Import sits beside it, quieter, because it
 *   happens once.
 *
 * **Nothing here is invented.** The reference this follows carries an upgrade
 * button, a comment button and a chart; two of those have no feature behind
 * them in this app, and drawing chrome for a thing that does not exist is the
 * dead UI the house rules forbid.
 */

export function EditorTopBar({
  bookId,
  bookTitle,
  chapterTitle,
  words,
  saveState,
  focus,
  onFocus,
  history,
  fileActions,
  importControl,
}: {
  bookId: string;
  bookTitle: string;
  chapterTitle: string;
  /**
   * Whether the work is safe, in the words the editor already uses.
   *
   * A string rather than the status enum, because for a book somebody let a
   * reader *read* this reports the permission instead — "Read-only · shared
   * with you" — and that decision belongs with the editor that knows the role,
   * not with the bar that draws it.
   */
  /** How much has been written, already formatted by the surface counting it. */
  words: string;
  saveState: string;
  /**
   * Whether the chrome is hidden, and how to hide it.
   *
   * The bar draws the button but does not own the mode: what it hides is the
   * bar itself, so a bar deciding it would be deciding its own existence.
   */
  focus: boolean;
  onFocus: (on: boolean) => void;
  /** Undo and redo. Passed in — `HistoryControls` needs the live editor. */
  history?: React.ReactNode;
  /** The rows of the File menu, which are the screen's to decide. */
  fileActions?: React.ReactNode;
  /** The import control, which owns its own file input and dialogs. */
  importControl?: React.ReactNode;
}) {
  /* The mark’s motion is this button’s to start, for the reason written beside
     `RailButton`: an 18px glyph in a 32px target is left alone through most of
     a hover if it waits for its own. Focus counts as being on it too. */
  const home = useMarkHandle();

  return (
    <header
      /* `shrink-0`, or a long chapter title squeezes the bar out of the column
         it shares with the page. */
      /* `relative` is what the centred title is positioned against. */
      /* Named for the one CSS rule that has to find it: in continuous layout
         the phone draws `MobileEditorHeader` instead, and for a day it drew
         both, one under the other. */
      className="editor-top-bar nav-chrome relative flex h-12 shrink-0
                 items-center gap-1 border-b border-line px-3"
    >
      {/* **The one way back to the shelf.** The rail carried a second one
          until 2026-09-05, which is a question about whether the two differ
          rather than a way home. It wears the rail’s own animated mark, so the
          button that left and the button that stayed are the same drawing. */}
      <Link
        href="/"
        aria-label="All books"
        onMouseEnter={home.onEnter}
        onMouseLeave={home.onLeave}
        onFocus={home.onEnter}
        onBlur={home.onLeave}
        className="group relative flex h-8 w-8 shrink-0 items-center
                   justify-center rounded-lg text-fg/80 outline-none
                   transition-colors hover:bg-raised hover:text-fg
                   focus-visible:ring-2 focus-visible:ring-accent/60"
      >
        <RailMark mark="home" markRef={home.ref} size={18} />
        <Tooltip label="All books" side="bottom" align="start" nowrap />
      </Link>

      {fileActions && (
        <Menu
          label="File"
          align="start"
          width={248}
          triggerClassName="flex shrink-0 items-center gap-1 rounded-lg px-2.5
                            py-1.5 font-sans text-sm text-fg outline-none
                            transition-colors hover:bg-raised
                            focus-visible:ring-2 focus-visible:ring-accent/60"
          trigger={
            <>
              File
              <span className="text-muted [&>svg]:h-3.5 [&>svg]:w-3.5">
                {shelfIcons.chevron}
              </span>
            </>
          }
        >
          {() => <>{fileActions}</>}
        </Menu>
      )}

      {history && (
        <>
          <Rule />
          <div className="flex shrink-0 items-center gap-0.5">{history}</div>
        </>
      )}

      <Rule />

      {/* **The save state reads as a sentence, not a status light.** It is the
          corner a writer checks to find out whether their work is safe, and on
          a book shared read-only it says so instead — which is the only place
          in the editor that explains why the page will not take a keystroke. */}
      {/* **The two readings, together.** They were at opposite ends of a strip
          of desk below this bar, which existed to hold them and nothing else
          once the controls around them had moved. Side by side up here they are
          one glance rather than two, and the row they were on is gone. */}
      <span className="pointer-events-none shrink-0 truncate font-sans text-xs tabular-nums text-muted">
        {words}
      </span>
      {/* The separator belongs to the pair, not to either reading. Both
          arrive from the surface a beat after the bar first paints, so an
          unconditional dot is a bullet floating on its own in the corner for
          the width of a mount. */}
      {words && saveState && (
        <span aria-hidden="true" className="shrink-0 text-xs text-muted">
          ·
        </span>
      )}
      <span
        aria-live="polite"
        className="pointer-events-none shrink-0 truncate font-sans text-xs text-muted"
      >
        {saveState}
      </span>

      {/* **The title is centred on the window, not on what is left of the row.**
          `absolute` rather than a flex child, so it stays put as the save state
          grows from "Saved" to "Saved · 8:16 pm" and as the groups either side
          change width. A title that drifts while you type is a title you have
          to look for. Hidden where there is no room for it rather than
          truncated to nothing. */}
      <div className="pointer-events-none absolute left-1/2 hidden -translate-x-1/2 items-baseline gap-2 lg:flex">
        <span className="max-w-[18rem] truncate font-sans text-sm font-semibold text-fg">
          {bookTitle}
        </span>
        <span aria-hidden="true" className="text-muted">
          ·
        </span>
        <span className="max-w-[14rem] truncate font-sans text-sm text-muted">
          {chapterTitle}
        </span>
      </div>

      <div className="ml-auto flex shrink-0 items-center gap-2">
        {/* **A view control, so it stands with the two that leave the app
            rather than beside the File menu** — nothing it does touches the
            manuscript. The glyph is the panel one, because this and the button
            that comes back are one control saying *chrome on, chrome off*. */}
        <button
          type="button"
          onClick={() => onFocus(!focus)}
          aria-pressed={focus}
          aria-label="Focus mode"
          className="group relative flex h-8 w-8 shrink-0 items-center
                     justify-center rounded-lg text-fg/80 outline-none
                     transition-colors hover:bg-raised hover:text-fg
                     focus-visible:ring-2 focus-visible:ring-accent/60"
        >
          <svg
            aria-hidden="true"
            viewBox="0 0 20 20"
            fill="none"
            stroke="currentColor"
            strokeWidth={1.5}
            strokeLinecap="round"
            strokeLinejoin="round"
            className="h-[18px] w-[18px]"
          >
            {icons.panel}
          </svg>
          <Tooltip label="Focus mode" side="bottom" align="end" nowrap />
        </button>
        {importControl}
        <Link
          href={`/book/${bookId}/export`}
          className="rounded-lg bg-accent px-3 py-1.5 font-sans text-sm
                     font-semibold text-accent-ink outline-none
                     transition-colors hover:bg-accent-strong
                     focus-visible:ring-2 focus-visible:ring-accent/60"
        >
          Export
        </Link>
      </div>
    </header>
  );
}

function Rule() {
  return <span aria-hidden="true" className="mx-1 h-5 w-px shrink-0 bg-line" />;
}

export { MenuButton as FileMenuItem, MenuLink as FileMenuLink, MenuSeparator };
