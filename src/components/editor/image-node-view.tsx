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
  const wrapperRef = useRef<HTMLDivElement>(null);

  const startResize = (side: "left" | "right") => (e: React.PointerEvent) => {
    // Keep the resize to ourselves — otherwise the drag starts a selection.
    e.preventDefault();
    e.stopPropagation();

    const wrapper = wrapperRef.current;
    const frame = wrapper?.querySelector<HTMLElement>(".image-nv-frame");
    if (!wrapper || !frame) return;

    const columnWidth = wrapper.clientWidth;
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
      style={{ textAlign: align as "left" | "center" | "right" }}
    >
      <span
        className={`image-nv-frame${selected ? " is-selected" : ""}`}
        style={{ width: width ?? undefined }}
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
