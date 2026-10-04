"use client";

import {
  useRef,
  useState,
  type CSSProperties,
  type PointerEvent as ReactPointerEvent,
  type RefObject,
} from "react";

/**
 * The bar at the top of a bottom sheet, and the drag that dismisses it.
 *
 * **Three sheets need this** — the dashboard's navigation on a phone, and the
 * editor's Format and More writing tools panels through `ResponsivePanel` — so
 * it lands in `ui/` rather than being written out a third time.
 *
 * **Dragging is never the only way out.** A pointer gesture has no keyboard or
 * screen-reader equivalent, so every sheet that uses this keeps Escape and a
 * backdrop press, both of which the native `<dialog>` and the existing
 * backdrop handler already give. This is the gesture a thumb reaches for
 * first, not the one anybody is required to find.
 */

/** Past this much of the sheet's own height, a release dismisses it. */
const DISMISS_FRACTION = 0.25;
/** px per ms. A flick dismisses from anywhere, as long as it actually moved. */
const FLICK_SPEED = 0.5;
const FLICK_MIN_TRAVEL = 24;

export function useSheetDrag(ref: RefObject<HTMLDialogElement | null>) {
  const [offset, setOffset] = useState(0);
  const [dragging, setDragging] = useState(false);
  const from = useRef<{ id: number; y: number; at: number } | null>(null);

  const finish = (event: ReactPointerEvent<HTMLElement>) => {
    const start = from.current;
    if (!start || start.id !== event.pointerId) return;
    from.current = null;
    setDragging(false);

    const travelled = Math.max(0, event.clientY - start.y);
    const height = ref.current?.getBoundingClientRect().height ?? 0;
    const elapsed = Math.max(1, performance.now() - start.at);
    const far = height > 0 && travelled > height * DISMISS_FRACTION;
    const flicked =
      travelled / elapsed > FLICK_SPEED && travelled > FLICK_MIN_TRAVEL;

    /* `close()` rather than calling the caller's handler: every one of these
       dialogs does its real work in `onClose` — clearing the open flag and
       handing focus back to the control that opened it — and a dismissal that
       went around it would leave the caret nowhere. */
    if (far || flicked) ref.current?.close();

    // Springs back when it was not far enough. Harmless after a close.
    setOffset(0);
  };

  const gripProps = {
    onPointerDown: (event: ReactPointerEvent<HTMLElement>) => {
      from.current = { id: event.pointerId, y: event.clientY, at: performance.now() };
      event.currentTarget.setPointerCapture(event.pointerId);
      setDragging(true);
      setOffset(0);
    },
    onPointerMove: (event: ReactPointerEvent<HTMLElement>) => {
      const start = from.current;
      if (!start || start.id !== event.pointerId) return;
      // Downward only. Dragging a sheet *up* past its own top edge is a pull
      // on something with nothing behind it.
      setOffset(Math.max(0, event.clientY - start.y));
    },
    onPointerUp: finish,
    onPointerCancel: finish,
  };

  /**
   * Transform only. The transition lives in `globals.css` on
   * `.oc-sheet-draggable`, because it has to come off under
   * `prefers-reduced-motion` and an inline style cannot ask a media query.
   * `data-dragging` is what kills it while a finger is down — a transition
   * there would make the sheet lag behind the thumb.
   */
  const dialogProps = {
    "data-dragging": dragging ? "true" : undefined,
    style: (offset
      ? { transform: `translateY(${offset}px)` }
      : undefined) as CSSProperties | undefined,
  };

  return { gripProps, dialogProps };
}

/**
 * The handle itself.
 *
 * The bar is 36×4 and the press area around it is 44px tall, because a thumb
 * aimed at a 4px line misses it. `touch-action: none` is load-bearing: without
 * it the browser claims the vertical drag for scrolling and the sheet never
 * moves.
 */
export function SheetGrip({
  gripProps,
  label = "Drag down to close",
}: {
  gripProps: ReturnType<typeof useSheetDrag>["gripProps"];
  label?: string;
}) {
  return (
    <div
      {...gripProps}
      aria-hidden="true"
      title={label}
      className="flex h-11 shrink-0 cursor-grab touch-none items-center justify-center
                 active:cursor-grabbing"
    >
      <span className="h-1 w-9 rounded-full bg-muted/50" />
    </div>
  );
}
