"use client";

import {
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import Link from "next/link";

/**
 * A menu that drops from the control that opened it.
 *
 * `account-menu.tsx` ends with a note: two popovers had been written by hand,
 * and *"if a third popover ever appears, that is the moment to lift the
 * anchoring out rather than write it a third time"*. This is that moment — the
 * dashboard grew a New-book menu and a per-book actions menu in the same pass.
 * The two existing ones still carry their own copy and are marked for migration
 * rather than rewritten blind; sign-out and the book row are working UI, and
 * moving them is a change to make deliberately, not as a side effect.
 *
 * Three things are load-bearing and all three are the reasons a hand-rolled
 * popover goes wrong:
 *
 * **Portalled and fixed.** The dashboard scrolls inside a pane, and any
 * ancestor with `overflow` clips an absolutely positioned child — the menu
 * would be cut off by the edge of the card it belongs to.
 *
 * **Measured, then clamped, then flipped.** Position comes from the trigger's
 * own rect after the menu has been laid out, so a menu near the right edge
 * slides back into view and one near the bottom opens upward instead of off
 * the fold.
 *
 * **Focus goes back where it came from.** Closing with Escape returns focus to
 * the trigger; without that, a keyboard user is dropped at the top of the
 * document and has to find their place again.
 */

const EDGE = 8;

export function Menu({
  trigger,
  triggerClassName,
  label,
  align = "start",
  width = 224,
  children,
}: {
  /** What the button shows. */
  trigger: ReactNode;
  triggerClassName?: string;
  /** Named for screen readers, since most triggers here are an icon. */
  label: string;
  /** Which edge of the trigger the menu lines up with. */
  align?: "start" | "end";
  width?: number;
  /** Given `close`, so an item can act and dismiss in one gesture. */
  children: (close: () => void) => ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [at, setAt] = useState<{ top: number; left: number } | null>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const id = useId();

  const close = useCallback(() => setOpen(false), []);

  /**
   * Place it, once it exists and can be measured.
   *
   * Layout effect rather than effect: this runs before paint, so the menu is
   * never seen at the top-left of the window for a frame before jumping to
   * its trigger.
   */
  useLayoutEffect(() => {
    if (!open) return;
    const trigger = triggerRef.current;
    const menu = menuRef.current;
    if (!trigger || !menu) return;

    const rect = trigger.getBoundingClientRect();
    const height = menu.offsetHeight;

    // Below by default; above when below would run off the fold and above has
    // more room. Not simply "above if it does not fit", or a menu on a short
    // window flips to a spot that fits no better.
    const below = rect.bottom + 6;
    const wantsAbove =
      below + height > window.innerHeight - EDGE && rect.top > height + EDGE;

    const left = align === "end" ? rect.right - width : rect.left;

    setAt({
      top: wantsAbove ? rect.top - height - 6 : below,
      left: Math.min(
        Math.max(EDGE, left),
        Math.max(EDGE, window.innerWidth - width - EDGE),
      ),
    });
  }, [open, align, width]);

  // Anything that moves the trigger invalidates the position. Closing is the
  // honest response — chasing a scrolling anchor costs a listener on every
  // frame to solve a problem no writer has while a menu is open.
  useEffect(() => {
    if (!open) return;
    const onDismiss = () => setOpen(false);
    window.addEventListener("scroll", onDismiss, true);
    window.addEventListener("resize", onDismiss);
    return () => {
      window.removeEventListener("scroll", onDismiss, true);
      window.removeEventListener("resize", onDismiss);
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      setOpen(false);
      triggerRef.current?.focus();
    };
    const onDown = (event: MouseEvent) => {
      const target = event.target as Node;
      if (menuRef.current?.contains(target)) return;
      if (triggerRef.current?.contains(target)) return;
      setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    // Pointer-down rather than click: a click that started inside the menu and
    // ended outside it should not dismiss, and vice versa.
    document.addEventListener("mousedown", onDown);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("mousedown", onDown);
    };
  }, [open]);

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        aria-label={label}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? id : undefined}
        onClick={() => setOpen((was) => !was)}
        className={triggerClassName}
      >
        {trigger}
      </button>

      {open &&
        typeof document !== "undefined" &&
        createPortal(
          <div
            ref={menuRef}
            id={id}
            role="menu"
            aria-label={label}
            style={{
              width,
              // Off-screen until measured, rather than at 0,0 — a menu that
              // flashes in the corner reads as a bug even though it lasts one
              // frame.
              top: at?.top ?? -9999,
              left: at?.left ?? -9999,
            }}
            className="fixed z-50 overflow-hidden rounded-xl border border-line
                       bg-panel p-1 shadow-xl shadow-black/10"
          >
            {children(close)}
          </div>,
          document.body,
        )}
    </>
  );
}

const ITEM =
  "flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-sm " +
  "text-fg hover:bg-raised focus-visible:bg-raised focus-visible:outline-none";

export function MenuLink({
  href,
  icon,
  onNavigate,
  children,
}: {
  href: string;
  icon?: ReactNode;
  onNavigate: () => void;
  children: ReactNode;
}) {
  return (
    <Link href={href} role="menuitem" onClick={onNavigate} className={ITEM}>
      {icon && <span className="text-muted">{icon}</span>}
      {children}
    </Link>
  );
}

export function MenuButton({
  onClick,
  icon,
  danger,
  children,
}: {
  onClick: () => void;
  icon?: ReactNode;
  /** Destructive, so it reads differently before it is pressed. */
  danger?: boolean;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      role="menuitem"
      onClick={onClick}
      className={`${ITEM} ${danger ? "text-danger" : ""}`}
    >
      {icon && (
        <span className={danger ? "text-current" : "text-muted"}>{icon}</span>
      )}
      {children}
    </button>
  );
}

export function MenuSeparator() {
  return <div role="separator" className="my-1 h-px bg-line" />;
}

export function MenuLabel({ children }: { children: ReactNode }) {
  return (
    <p className="px-2.5 pt-2 pb-1 text-xs font-bold tracking-wide text-muted uppercase">
      {children}
    </p>
  );
}
