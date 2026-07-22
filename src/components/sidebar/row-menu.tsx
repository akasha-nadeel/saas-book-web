"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

/**
 * The ⋯ menu on a sidebar row.
 *
 * Portalled, which is not decoration: the chapter list scrolls, and an
 * ancestor with overflow clips absolutely positioned children. Anchored inside
 * it the menu would be drawn and then cut off at the panel's edge. The cost is
 * positioning by hand from the trigger's rect, and closing on scroll — a fixed
 * position taken from a rect goes stale the moment anything moves.
 *
 * Opened by click rather than hover. Hover menus cannot be reached from a
 * keyboard, do not exist on a touch screen, and a destructive action should
 * never be one stray mouse movement away.
 */

export interface RowMenuItem {
  label: string;
  /** Single letter shown on the right, matching the reference. */
  hint?: string;
  icon: React.ReactNode;
  onSelect: () => void;
  danger?: boolean;
}

/**
 * Three dots are a small target on a busy background, so everything but the
 * chrome case sits on its own chip. Contrast that depends on what the writer
 * happened to upload is not contrast.
 */
const TONE: Record<"chrome" | "paper" | "art", string> = {
  chrome: "text-fg hover:bg-raised",
  paper: "bg-black/10 text-[#16191f] hover:bg-black/25",
  art: "bg-black/45 text-white hover:bg-black/65",
};

const MENU_WIDTH = 208;
/** Roughly one item, so a menu never opens with its last item off screen. */
const EDGE_PADDING = 8;

export function RowMenu({
  label,
  items,
  tone = "chrome",
  active = false,
}: {
  /** Names the row this menu belongs to, for screen readers. */
  label: string;
  items: RowMenuItem[];
  /**
   * Where the trigger sits. "paper" is a light surface, "art" is somebody's
   * photograph — which could be any colour, so that one carries its own dark
   * chip rather than trusting the image underneath it.
   */
  tone?: "chrome" | "paper" | "art";
  /**
   * Keep the trigger shown rather than revealing it on hover. Set on the row
   * the writer is already on: its actions should be one click away, not one
   * hover, and it is the one row a touch user cannot hover to find.
   */
  active?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [rect, setRect] = useState<DOMRect | null>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  const close = (returnFocus = true) => {
    setOpen(false);
    // Focus would otherwise fall to the body, losing the reader's place in the
    // list entirely.
    if (returnFocus) triggerRef.current?.focus();
  };

  useEffect(() => {
    if (!open) return;

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        close();
      }
    };
    const onPointer = (e: PointerEvent) => {
      const target = e.target as Node;
      // The menu is portalled, so it is not inside the trigger's subtree —
      // both have to be checked or selecting an item would dismiss it first.
      if (
        !triggerRef.current?.contains(target) &&
        !menuRef.current?.contains(target)
      ) {
        close(false);
      }
    };
    const onMove = () => close(false);

    document.addEventListener("keydown", onKey);
    document.addEventListener("pointerdown", onPointer);
    window.addEventListener("resize", onMove);
    // Capture, so a scroll in the chapter list is caught and not just one on
    // the window.
    document.addEventListener("scroll", onMove, true);

    // The first item, so the menu is usable without touching the mouse.
    menuRef.current?.querySelector("button")?.focus();

    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("pointerdown", onPointer);
      window.removeEventListener("resize", onMove);
      document.removeEventListener("scroll", onMove, true);
    };
  }, [open]);

  /** Up and down through the items, wrapping at both ends. */
  const onMenuKeyDown = (e: React.KeyboardEvent) => {
    if (e.key !== "ArrowDown" && e.key !== "ArrowUp") return;
    e.preventDefault();

    const buttons = Array.from(
      menuRef.current?.querySelectorAll("button") ?? [],
    );
    if (!buttons.length) return;

    const at = buttons.indexOf(document.activeElement as HTMLButtonElement);
    const next =
      e.key === "ArrowDown"
        ? (at + 1) % buttons.length
        : (at - 1 + buttons.length) % buttons.length;
    buttons[next].focus();
  };

  const openMenu = () => {
    setRect(triggerRef.current?.getBoundingClientRect() ?? null);
    setOpen(true);
  };

  // Measured rather than guessed. Clamping the top edge alone is not enough —
  // that only slides the menu down the screen while its own height carries on
  // past the bottom, which is what left the last item cut off for rows near
  // the foot of the list.
  const [height, setHeight] = useState(0);
  useLayoutEffect(() => {
    if (open && menuRef.current) setHeight(menuRef.current.offsetHeight);
    else setHeight(0);
  }, [open]);

  const roomBelow = rect ? window.innerHeight - rect.bottom - EDGE_PADDING : 0;
  const roomAbove = rect ? rect.top - EDGE_PADDING : 0;

  // Flip above the trigger when it does not fit below and there is more room
  // up there. Before the first measurement height is 0, so this opens
  // downwards — useLayoutEffect then corrects it before the browser paints.
  const flip = height > roomBelow && roomAbove > roomBelow;

  // Anchoring the flipped menu by its bottom edge means the height never has to
  // enter the arithmetic, so there is no second measure-and-reposition pass.
  const vertical =
    rect && flip
      ? { bottom: window.innerHeight - rect.top + 4 }
      : { top: rect ? rect.bottom + 4 : 0 };

  // A menu taller than the screen scrolls rather than spilling off it.
  const maxHeight = Math.max(120, flip ? roomAbove - 4 : roomBelow - 4);

  const left = rect
    ? Math.max(
        EDGE_PADDING,
        Math.min(
          rect.right - MENU_WIDTH,
          window.innerWidth - MENU_WIDTH - EDGE_PADDING,
        ),
      )
    : 0;

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        onClick={(e) => {
          // The row is a link; without this the menu opens and navigates.
          e.preventDefault();
          e.stopPropagation();
          if (open) close(false);
          else openMenu();
        }}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={`Actions for ${label}`}
        title="More"
        // Hover is handled in CSS rather than React state: tracking which row
        // is hovered would re-render the whole list on every mouse move.
        className={`flex h-7 w-7 items-center justify-center rounded-md
                    outline-none transition-opacity group-hover:opacity-100
                    focus-visible:opacity-100 focus-visible:ring-2
                    focus-visible:ring-accent/60 ${TONE[tone]} ${
                      open || active ? "opacity-100" : "opacity-0"
                    }`}
      >
        <svg
          aria-hidden="true"
          viewBox="0 0 16 16"
          fill="currentColor"
          className="h-4 w-4"
        >
          <circle cx="8" cy="3" r="1.4" />
          <circle cx="8" cy="8" r="1.4" />
          <circle cx="8" cy="13" r="1.4" />
        </svg>
      </button>

      {open &&
        rect &&
        createPortal(
          <div
            ref={menuRef}
            role="menu"
            aria-label={`Actions for ${label}`}
            onKeyDown={onMenuKeyDown}
            style={{
              position: "fixed",
              left,
              width: MENU_WIDTH,
              maxHeight,
              ...vertical,
            }}
            className="z-50 overflow-y-auto rounded-lg border border-line
                       bg-panel p-1.5 shadow-xl"
          >
            {items.map((item, i) => (
              <div key={item.label}>
                {/* A rule above the destructive action, so it is not the next
                    thing down from a harmless one. */}
                {item.danger && i > 0 && (
                  <div aria-hidden="true" className="my-1.5 h-px bg-line" />
                )}
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    close(false);
                    item.onSelect();
                  }}
                  className={`flex w-full items-center gap-2.5 rounded-md px-2.5
                              py-2 text-left font-sans text-sm outline-none
                              transition-colors focus-visible:ring-2
                              focus-visible:ring-accent/60 ${
                                item.danger
                                  ? "text-red-400 hover:bg-red-400/10"
                                  : "text-fg hover:bg-raised"
                              }`}
                >
                  <span className="shrink-0 [&>svg]:h-4 [&>svg]:w-4">
                    {item.icon}
                  </span>
                  <span className="flex-1 truncate">{item.label}</span>
                  {item.hint && (
                    <span className="shrink-0 font-sans text-xs text-muted">
                      {item.hint}
                    </span>
                  )}
                </button>
              </div>
            ))}
          </div>,
          document.body,
        )}
    </>
  );
}

/** Inline so the sidebar carries no icon dependency, matching the rails. */
export const menuIcons = {
  star: (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5">
      <path
        d="m10 2.5 2.3 4.9 5.2.7-3.8 3.7.9 5.2-4.6-2.5-4.6 2.5.9-5.2-3.8-3.7 5.2-.7z"
        strokeLinejoin="round"
      />
    </svg>
  ),
  starFilled: (
    <svg viewBox="0 0 20 20" fill="currentColor">
      <path d="m10 2.5 2.3 4.9 5.2.7-3.8 3.7.9 5.2-4.6-2.5-4.6 2.5.9-5.2-3.8-3.7 5.2-.7z" />
    </svg>
  ),
  rename: (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5">
      <path
        d="M13.5 3.5a1.8 1.8 0 0 1 2.5 2.5L7.5 14.5l-3.5 1 1-3.5z"
        strokeLinejoin="round"
      />
    </svg>
  ),
  archive: (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5">
      <rect x="2.8" y="4" width="14.4" height="3.6" rx="1" />
      <path
        d="M4.4 7.6v7a1.4 1.4 0 0 0 1.4 1.4h8.4a1.4 1.4 0 0 0 1.4-1.4v-7"
        strokeLinecap="round"
      />
      <path d="M8.2 10.8h3.6" strokeLinecap="round" />
    </svg>
  ),
  restore: (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5">
      <path
        d="M3.4 9.6a6.6 6.6 0 1 1 1.9 4.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path d="M3.2 5.4v4.2h4.2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
  export: (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5">
      <path d="M10 2.9v8.7" strokeLinecap="round" />
      <path d="m6.4 8.2 3.6 3.6 3.6-3.6" strokeLinecap="round" strokeLinejoin="round" />
      <path
        d="M3.4 13.6v1.9a1.6 1.6 0 0 0 1.6 1.6h10a1.6 1.6 0 0 0 1.6-1.6v-1.9"
        strokeLinecap="round"
      />
    </svg>
  ),
  hide: (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5">
      <path
        d="M3 3.2 17 16.8"
        strokeLinecap="round"
      />
      <path
        d="M7.4 5.6A7.6 7.6 0 0 1 10 5.2c4 0 6.6 2.8 7.4 4.8a9.6 9.6 0 0 1-2.6 3.3M12.3 12.4A2.6 2.6 0 0 1 8 10.2M5.5 7A9.7 9.7 0 0 0 2.6 10c.8 2 3.4 4.8 7.4 4.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  ),
  show: (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5">
      <path
        d="M2.6 10C3.4 8 6 5.2 10 5.2S16.6 8 17.4 10c-.8 2-3.4 4.8-7.4 4.8S3.4 12 2.6 10z"
        strokeLinejoin="round"
      />
      <circle cx="10" cy="10" r="2.4" />
    </svg>
  ),
  trash: (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5">
      <path
        d="M3.5 5.5h13M8 5.5V4a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1v1.5M5.5 5.5l.7 10a1 1 0 0 0 1 .9h5.6a1 1 0 0 0 1-.9l.7-10"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  ),
};
