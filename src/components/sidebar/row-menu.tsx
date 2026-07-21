"use client";

import { useEffect, useRef, useState } from "react";
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

const MENU_WIDTH = 208;
/** Roughly one item, so a menu never opens with its last item off screen. */
const EDGE_PADDING = 8;

export function RowMenu({
  label,
  items,
}: {
  /** Names the row this menu belongs to, for screen readers. */
  label: string;
  items: RowMenuItem[];
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

  // Opens below the trigger and right-aligned to it, then is pulled back on
  // screen if the row sits near an edge.
  const top = rect
    ? Math.min(rect.bottom + 4, window.innerHeight - EDGE_PADDING)
    : 0;
  const left = rect
    ? Math.max(EDGE_PADDING, Math.min(rect.right - MENU_WIDTH, window.innerWidth - MENU_WIDTH - EDGE_PADDING))
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
        className={`absolute top-1/2 right-2 flex h-7 w-7 -translate-y-1/2
                    items-center justify-center rounded-md text-muted
                    outline-none transition-opacity hover:bg-raised
                    hover:text-fg group-hover:opacity-100
                    focus-visible:opacity-100 focus-visible:ring-2
                    focus-visible:ring-accent/60 ${
                      open ? "bg-raised text-fg opacity-100" : "opacity-0"
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
            style={{ position: "fixed", top, left, width: MENU_WIDTH }}
            className="z-50 rounded-lg border border-line bg-panel p-1.5 shadow-xl"
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
