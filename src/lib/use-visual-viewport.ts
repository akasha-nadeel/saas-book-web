"use client";

import { useEffect } from "react";
import {
  editorLayoutFor,
  type EditorLayout,
  type EditorViewportMetrics,
} from "./editor/editor-layout";

export const EDITOR_LAYOUT_EVENT = "openchapter:editor-layout";

interface VisualViewportLike extends EventTarget {
  width: number;
  height: number;
  offsetTop: number;
  /** 1 unless the reader has pinched. Absent on the fakes in the tests. */
  scale?: number;
}

export interface VisualViewportSnapshot extends EditorViewportMetrics {
  layoutWidth: number;
  layoutHeight: number;
  offsetTop: number;
  keyboardInset: number;
}

interface ViewportWindow {
  innerWidth: number;
  innerHeight: number;
  visualViewport?: VisualViewportLike | null;
  requestAnimationFrame(callback: FrameRequestCallback): number;
  cancelAnimationFrame(handle: number): void;
  addEventListener(
    type: string,
    listener: EventListenerOrEventListenerObject,
    options?: boolean | AddEventListenerOptions,
  ): void;
  removeEventListener(
    type: string,
    listener: EventListenerOrEventListenerObject,
    options?: boolean | EventListenerOptions,
  ): void;
}

/**
 * Read one internally consistent viewport snapshot.
 *
 * **A pinch is not a keyboard, and the difference is `scale`.** The visual
 * viewport shrinks for two unrelated reasons: a software keyboard has covered
 * part of the window, or the reader has zoomed in and is looking at a slice of
 * the page. This module exists for the first — the app shell is sized to the
 * visible height so a sticky bar cannot end up under the keyboard — and taking
 * the second the same way is how a zoomed-in dashboard ends up as a short strip
 * of application with the page's background under it: the shell was told to be
 * a third of the window tall, and it obeyed.
 *
 * Zoomed in, the layout viewport is the honest answer, so that is what is
 * published; `scale` is 1 for a keyboard and greater than 1 for a pinch. Page
 * zoom (Ctrl and +) never reaches here at all, because it scales the CSS pixel
 * itself and both viewports shrink together.
 */
export function visualViewportSnapshot(
  target: Pick<
    ViewportWindow,
    "innerWidth" | "innerHeight" | "visualViewport"
  >,
): VisualViewportSnapshot {
  const visual = target.visualViewport;
  // A hair over 1, because the scale is a float and a trackpad leaves it at
  // 1.0000001 after a pinch that ended where it started.
  const pinched = (visual?.scale ?? 1) > 1.01;
  const width = Math.max(
    0,
    pinched ? target.innerWidth : (visual?.width ?? target.innerWidth),
  );
  const height = Math.max(
    0,
    pinched ? target.innerHeight : (visual?.height ?? target.innerHeight),
  );
  const offsetTop = pinched ? 0 : Math.max(0, visual?.offsetTop ?? 0);

  return {
    width,
    height,
    layoutWidth: Math.max(0, target.innerWidth),
    layoutHeight: Math.max(0, target.innerHeight),
    offsetTop,
    // On browsers where interactive-widget resizes the layout viewport this is
    // naturally zero. On iOS-style visual-only resizing it is the keyboard.
    keyboardInset: Math.max(0, target.innerHeight - height - offsetTop),
  };
}

function writeSnapshot(
  root: HTMLElement,
  snapshot: VisualViewportSnapshot,
  layout: EditorLayout,
) {
  root.style.setProperty("--oc-visual-width", `${snapshot.width}px`);
  root.style.setProperty("--oc-visual-height", `${snapshot.height}px`);
  root.style.setProperty("--oc-visual-offset-top", `${snapshot.offsetTop}px`);
  root.style.setProperty(
    "--oc-keyboard-inset",
    `${snapshot.keyboardInset}px`,
  );
  // Full-height application shells use the space that is actually visible.
  // On browsers where the keyboard only shrinks VisualViewport, using
  // innerHeight here would leave sticky actions underneath it.
  root.style.setProperty("--oc-layout-height", `${snapshot.height}px`);
  root.dataset.editorLayout = layout.mode;
  root.dataset.editorNavigator = layout.persistentBookNavigator
    ? "persistent"
    : "overlay";
  root.dataset.editorTools = layout.persistentToolRail
    ? "persistent"
    : "overlay";
}

/**
 * Publish mobile viewport geometry without putting animation-frame values in
 * React state. All DOM writes are coalesced into one requestAnimationFrame.
 */
export function installVisualViewportCssVariables(
  root: HTMLElement,
  target: ViewportWindow,
): () => void {
  let frame = 0;
  let lastLayoutKey = [
    root.dataset.editorLayout,
    root.dataset.editorNavigator,
    root.dataset.editorTools,
  ].join(":");

  const flush = () => {
    frame = 0;
    const snapshot = visualViewportSnapshot(target);
    const layout = editorLayoutFor(snapshot);
    writeSnapshot(root, snapshot, layout);

    const layoutKey = [
      layout.mode,
      layout.persistentBookNavigator,
      layout.persistentToolRail,
    ].join(":");
    if (layoutKey !== lastLayoutKey) {
      lastLayoutKey = layoutKey;
      root.dispatchEvent(
        new CustomEvent(EDITOR_LAYOUT_EVENT, {
          detail: layout,
          bubbles: true,
        }),
      );
    }
  };

  const schedule = () => {
    if (frame) return;
    frame = target.requestAnimationFrame(flush);
  };

  const passive = { passive: true } as const;
  target.addEventListener("resize", schedule, passive);
  target.addEventListener("orientationchange", schedule, passive);
  target.visualViewport?.addEventListener("resize", schedule, passive);
  target.visualViewport?.addEventListener("scroll", schedule, passive);
  schedule();

  return () => {
    target.removeEventListener("resize", schedule);
    target.removeEventListener("orientationchange", schedule);
    target.visualViewport?.removeEventListener("resize", schedule);
    target.visualViewport?.removeEventListener("scroll", schedule);
    if (frame) target.cancelAnimationFrame(frame);
  };
}

export function useVisualViewportCssVariables() {
  useEffect(
    () => installVisualViewportCssVariables(document.documentElement, window),
    [],
  );
}
