"use client";

import { useRef } from "react";
import { NodeViewWrapper, type NodeViewProps } from "@tiptap/react";
import { resizedPercent } from "@/lib/editor/image-resize";

/**
 * The image as it appears in the editor: a picture you can grab and resize.
 *
 * A plain <img> can only be inserted, not handled — so this renders the image
 * inside a frame that, when the image is selected, shows drag handles on either
 * side. Dragging one sets the image's width as a percentage of the text column,
 * so it stays proportional whatever the page size. Alignment (which side of the
 * column it sits on) and deletion come from the floating image toolbar.
 *
 * The width arithmetic is in `src/lib/editor/image-resize.ts`, where it can be
 * tested; what is left here is the pointer plumbing, which needs a browser.
 */
export function ImageNodeView({
  node,
  updateAttributes,
  selected,
  editor,
}: NodeViewProps) {
  const src = node.attrs.src as string;
  const alt = (node.attrs.alt as string) || "";
  const width = (node.attrs.width as string) || null;
  const align = (node.attrs.align as string) || "center";
  // Text runs beside the picture only when it has a side to sit on.
  const wrap = node.attrs.wrap === true && (align === "left" || align === "right");
  const wrapperRef = useRef<HTMLDivElement>(null);

  /* Takes the side as an argument rather than being curried into a handler:
     `startResize("left")` would be *called during render*, and a function
     invoked there may not read a ref — which is a real rule here, since the
     ref is null on the first render and the handler would close over it. */
  const startResize = (e: React.PointerEvent, side: "left" | "right") => {
    // Keep the resize to ourselves — otherwise the drag starts a selection.
    e.preventDefault();
    e.stopPropagation();

    const wrapper = wrapperRef.current;
    const frame = wrapper?.querySelector<HTMLElement>(".image-nv-frame");
    if (!wrapper || !frame) return;

    // A wrapping picture is floated, so it is only as wide as itself — the
    // column has to be measured from its parent instead, or every drag would
    // read the image's own width as 100% and it could never be made larger.
    const column = wrap ? (wrapper.parentElement ?? wrapper) : wrapper;
    const columnWidth = column.clientWidth;

    /*
     * How much bigger the page is drawn than it is laid out.
     *
     * The manuscript sits inside a CSS `zoom`, so a rect is in viewport pixels
     * while `clientWidth` is in layout pixels, and the pointer moves in the
     * former. Read as the ratio of the two rather than from the zoom setting,
     * which is what keeps it right whether the page is scaled by `zoom` or by a
     * transform — `pagination.ts` derives its own the same way and says so.
     */
    const rendered = column.getBoundingClientRect().width;
    const scale = columnWidth > 0 ? rendered / columnWidth : 1;

    const startX = e.clientX;
    const startWidth = frame.clientWidth;

    /*
     * The pointer is captured, so the drag survives leaving the handle — and,
     * more to the point, a release anywhere at all comes back to us. Without it
     * a button let go outside the window left the listeners attached and the
     * picture following the pointer with nothing held down.
     */
    const handle = e.currentTarget as HTMLElement;
    handle.setPointerCapture?.(e.pointerId);

    const onMove = (ev: PointerEvent) => {
      updateAttributes({
        width: `${resizedPercent({
          startWidth,
          columnWidth,
          dx: ev.clientX - startX,
          scale,
          side,
        })}%`,
      });
    };
    const stop = () => {
      handle.releasePointerCapture?.(e.pointerId);
      handle.removeEventListener("pointermove", onMove);
      handle.removeEventListener("pointerup", stop);
      // A gesture the system takes away — a touch becoming a scroll, a window
      // losing focus mid-drag — never sends pointerup. Left out, that is the
      // same stuck drag the capture above exists to prevent.
      handle.removeEventListener("pointercancel", stop);
    };
    handle.addEventListener("pointermove", onMove);
    handle.addEventListener("pointerup", stop);
    handle.addEventListener("pointercancel", stop);
  };

  return (
    <NodeViewWrapper
      ref={wrapperRef}
      className="image-nv"
      // The float is CSS, keyed off this attribute — see .image-nv[data-wrap]
      // in globals.css — so the editor, the reading view and the exports all
      // wrap the text the same way.
      data-wrap={wrap ? align : undefined}
      style={{
        textAlign: align as "left" | "center" | "right",
        // Floated, the wrapper shrinks to its content, so the picture's width
        // has to move up to it from the frame or the float would be full width.
        ...(wrap ? { width: width ?? "50%" } : null),
      }}
    >
      <span
        className={`image-nv-frame${selected ? " is-selected" : ""}`}
        style={{ width: wrap ? "100%" : (width ?? undefined) }}
        /*
         * **What makes the picture movable, and it was missing.**
         *
         * The image node declares itself draggable, so ProseMirror marks the
         * node view's root `draggable` — but Tiptap then cancels every
         * `dragstart` whose target is that root unless a `mousedown` has landed
         * inside something carrying `data-drag-handle` first. With no such
         * element anywhere in this view the drag was refused every time, and a
         * writer could not move a picture at all: cut and paste was the only
         * way, and nothing said so.
         *
         * On the frame rather than the `<img>` because the picture itself keeps
         * `draggable={false}` — that is what stops the browser's own image drag
         * racing the resize handles — and because the frame is the whole target
         * a writer would reach for.
         */
        data-drag-handle
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={src} alt={alt} draggable={false} />
        {selected && editor.isEditable && (
          <>
            <span
              className="image-nv-handle left"
              onPointerDown={(e) => startResize(e, "left")}
              aria-hidden="true"
            />
            <span
              className="image-nv-handle right"
              onPointerDown={(e) => startResize(e, "right")}
              aria-hidden="true"
            />
          </>
        )}
      </span>
    </NodeViewWrapper>
  );
}
