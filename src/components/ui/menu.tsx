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

/**
 * The least a menu will shrink to before it hangs into the space instead.
 *
 * Roughly three plain rows. A trigger near the bottom of the window has a few
 * pixels under it, and a menu that honoured that would be a sliver — so below
 * this it stops shrinking and is pulled back up the screen far enough to fit.
 */
const MIN_HEIGHT = 140;

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
  const [at, setAt] = useState<{
    top: number;
    left: number;
    maxHeight: number;
  } | null>(null);
  /* Where the open menu is portalled to, decided when it opens rather than
     during render — see `portalHost`. Reading a ref while rendering is both a
     lint error and a real hazard: the value is not tracked, so a menu opened
     before the ref settled would portal to the wrong place and never correct
     itself. Chosen in the click handler, where refs are safe to read. */
  const [host, setHost] = useState<HTMLElement | null>(null);
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
    // `scrollHeight`, not `offsetHeight`: once a previous pass has capped the
    // element, its offset height *is* the cap, and measuring that would make
    // every menu decide it fits perfectly wherever it happens to be.
    const height = menu.scrollHeight;

    const visual = window.visualViewport;
    const viewportTop = visual?.offsetTop ?? 0;
    const viewportLeft = visual?.offsetLeft ?? 0;
    const viewportHeight = visual?.height ?? window.innerHeight;
    const viewportWidth = visual?.width ?? window.innerWidth;
    const viewportBottom = viewportTop + viewportHeight;
    const below = rect.bottom + 6;
    const roomBelow = viewportBottom - below - EDGE;
    const roomAbove = rect.top - 6 - viewportTop - EDGE;

    // Below by default; above when below would run off the fold and above has
    // more room. Not simply "above if it does not fit", or a menu on a short
    // window flips to a spot that fits no better.
    const wantsAbove = height > roomBelow && roomAbove > roomBelow;

    /*
     * **A menu taller than the room it has scrolls; it does not run off the
     * screen.**
     *
     * This capped nothing, on the reasonable assumption that a menu is four or
     * five verbs. Then one grew a list — the front-matter Add-page menu offers
     * eight sections with a line of explanation each — and the last three items
     * were simply below the fold with no way to reach them. Flipping it above
     * the trigger does not help: the list is taller than the window either way.
     *
     * The floor matters as much as the cap. A trigger near the bottom edge has
     * almost no room under it, and a menu obediently drawn 12px tall is a menu
     * nobody can use — so it takes at least a few rows and hangs into the space
     * it was allotted, which is what the clamp on `top` below is for.
     */
    const maxHeight = Math.max(MIN_HEIGHT, wantsAbove ? roomAbove : roomBelow);
    const shown = Math.min(height, maxHeight);

    const left = align === "end" ? rect.right - width : rect.left;

    setAt({
      top: wantsAbove
        ? Math.max(viewportTop + EDGE, rect.top - shown - 6)
        : Math.min(
            below,
            Math.max(viewportTop + EDGE, viewportBottom - shown - EDGE),
          ),
      left: Math.min(
        Math.max(viewportLeft + EDGE, left),
        Math.max(viewportLeft + EDGE, viewportLeft + viewportWidth - width - EDGE),
      ),
      maxHeight,
    });
  }, [open, align, width]);

  // Anything that moves the trigger invalidates the position. Closing is the
  // honest response — chasing a scrolling anchor costs a listener on every
  // frame to solve a problem no writer has while a menu is open.
  useEffect(() => {
    if (!open) return;
    const onDismiss = (event: Event) => {
      // **Except the menu's own scrolling.** The listener is on the capture
      // phase so that it catches a scroll in any container, which now includes
      // this one — and a menu that dismissed itself the moment you scrolled it
      // would be a list you cannot reach the bottom of, which is the whole
      // problem the cap above was added to solve.
      if (
        event.type === "scroll" &&
        event.target instanceof Node &&
        menuRef.current?.contains(event.target)
      ) {
        return;
      }
      setOpen(false);
    };
    window.addEventListener("scroll", onDismiss, true);
    window.addEventListener("resize", onDismiss);
    window.visualViewport?.addEventListener("resize", onDismiss);
    window.visualViewport?.addEventListener("scroll", onDismiss);
    return () => {
      window.removeEventListener("scroll", onDismiss, true);
      window.removeEventListener("resize", onDismiss);
      window.visualViewport?.removeEventListener("resize", onDismiss);
      window.visualViewport?.removeEventListener("scroll", onDismiss);
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
        onClick={() => {
          if (!open) setHost(portalHost(triggerRef.current));
          setOpen((was) => !was);
        }}
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
              // Bounded by the window on the *first* pass too, before anything
              // has been measured. Without it a long menu is briefly laid out
              // at its full height, which on a short window is a scrollbar
              // appearing on the document for one frame.
              maxHeight: at?.maxHeight ?? `calc(100dvh - ${EDGE * 2}px)`,
            }}
            /* `overflow-y-auto` rather than `overflow-hidden`: the corners still
               need clipping, and a menu longer than its room has to be
               reachable. `overscroll-contain` stops a flick at the end of the
               list turning into a scroll of the page behind it — which, since
               scrolling the page dismisses the menu, would close it. */
            className="scroll-slim fixed z-50 overflow-x-hidden overflow-y-auto
                       overscroll-contain rounded-xl border border-line bg-panel
                       p-1 shadow-xl shadow-black/10"
          >
            {children(close)}
          </div>,
          host ?? document.body,
        )}
    </>
  );
}

/**
 * Where the menu is portalled to — and why it is not always `document.body`.
 *
 * **A `<dialog>` opened with `showModal()` lives in the browser's *top
 * layer*.** That is the property the app relies on elsewhere: it is what lets
 * the export's done dialog clear the roadmap's sheet and the export rail
 * without any z-index keeping in step with them. The top layer is above the
 * whole normal stacking context, and `z-index` cannot reach it — 50, 9999 or a
 * million all lose.
 *
 * So a menu portalled to `document.body` from *inside* a modal dialog opens
 * correctly, is positioned correctly, and is painted **behind the dialog's
 * backdrop** — invisible and unclickable. It reads as a dropdown that does not
 * work. That was the share dialog's role control, which is also where Remove
 * lives, so one stacking mistake made a member impossible to remove *and* made
 * their role impossible to change.
 *
 * The fix is to join the dialog in the top layer rather than fight it: portal
 * into the open `<dialog>` ancestor when there is one, and to `document.body`
 * otherwise. `position: fixed` still resolves against the viewport inside a
 * top-layer element, so the measured coordinates need no adjustment.
 *
 * `open` is checked rather than assumed: a `<dialog>` rendered but not shown
 * is an ordinary element, and portalling into a hidden one would hide the
 * menu just as thoroughly.
 */
function portalHost(trigger: Element | null): HTMLElement {
  const dialog = trigger?.closest("dialog");
  return dialog?.open ? dialog : document.body;
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
  hint,
  badge,
  children,
}: {
  onClick: () => void;
  icon?: ReactNode;
  /** Destructive, so it reads differently before it is pressed. */
  danger?: boolean;
  /**
   * A marker at the right end — "Soon" so far.
   *
   * The rail's own items have carried one since Community was announced there;
   * a menu item announcing an unbuilt feature needs to say so *before* it is
   * pressed for the same reason. A row that looks exactly like the working
   * rows above it and then explains itself in a dialog has already spent the
   * writer's press.
   */
  badge?: ReactNode;
  /**
   * A second line saying what the item is.
   *
   * For menus whose items are *terms* rather than actions — the front-matter
   * Add menu offers "Epigraph", which is a word a first novelist has had no
   * reason to learn, and eight of those in a column is eight guesses. An
   * ordinary menu of verbs needs none of this and should not carry it.
   */
  hint?: string;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      role="menuitem"
      onClick={onClick}
      // Top-aligned once there are two lines, or the icon and the label centre
      // themselves against the height of the pair and the label stops lining up
      // with the single-line items above it.
      className={`${ITEM} ${hint ? "items-start" : ""} ${
        danger ? "text-danger" : ""
      }`}
    >
      {icon && (
        <span className={danger ? "text-current" : "text-muted"}>{icon}</span>
      )}
      {hint ? (
        <span className="min-w-0 flex-1">
          <span className="block">{children}</span>
          <span className="mt-0.5 block text-xs leading-snug text-muted">
            {hint}
          </span>
        </span>
      ) : (
        <span className="min-w-0 flex-1 text-left">{children}</span>
      )}
      {badge}
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
