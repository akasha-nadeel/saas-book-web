"use client";

import { useRef } from "react";
import { NodeViewWrapper, type NodeViewProps } from "@tiptap/react";

/**
 * The image as it appears in the editor: a picture you can grab and resize.
 *
 * A plain <img> can only be inserted, not handled — so this renders the image
 * inside a frame that, when the image is selected, shows drag handles on either
 * side. Dragging one sets the image's width as a percentage of the text column,
 * so it stays proportional whatever the page size. Alignment (which side of the
 * column it sits on) and deletion come from the floating image toolbar.
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

  const startResize = (side: "left" | "right") => (e: React.PointerEvent) => {
    // Keep the resize to ourselves — otherwise the drag starts a selection.
    e.preventDefault();
    e.stopPropagation();

    const wrapper = wrapperRef.current;
    const frame = wrapper?.querySelector<HTMLElement>(".image-nv-frame");
    if (!wrapper || !frame) return;

    // A wrapping picture is floated, so it is only as wide as itself — the
    // column has to be measured from its parent instead, or every drag would
    // read the image's own width as 100% and it could never be made larger.
    const columnWidth = wrap
      ? (wrapper.parentElement?.clientWidth ?? wrapper.clientWidth)
      : wrapper.clientWidth;
    const startX = e.clientX;
    const startWidth = frame.clientWidth;

    const onMove = (ev: PointerEvent) => {
      const dx = ev.clientX - startX;
      // The left handle grows the image as it moves left, the right as it moves
      // right, so both feel like pulling the edge outward.
      const delta = side === "right" ? dx : -dx;
      const next = Math.max(40, Math.min(columnWidth, startWidth + delta));
      const percent = Math.round((next / columnWidth) * 100);
      updateAttributes({ width: `${percent}%` });
    };
    const onUp = () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
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
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={src} alt={alt} draggable={false} />
        {selected && editor.isEditable && (
          <>
            <span
              className="image-nv-handle left"
              onPointerDown={startResize("left")}
              aria-hidden="true"
            />
            <span
              className="image-nv-handle right"
              onPointerDown={startResize("right")}
              aria-hidden="true"
            />
          </>
        )}
      </span>
    </NodeViewWrapper>
  );
}
