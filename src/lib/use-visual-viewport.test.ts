import { describe, expect, it, vi } from "vitest";
import {
  EDITOR_LAYOUT_EVENT,
  installVisualViewportCssVariables,
  visualViewportSnapshot,
} from "./use-visual-viewport";

class FakeVisualViewport extends EventTarget {
  constructor(
    public width: number,
    public height: number,
    public offsetTop = 0,
  ) {
    super();
  }
}

function harness(width = 390, height = 844) {
  const visualViewport = new FakeVisualViewport(width, height);
  const events = new EventTarget();
  const frames = new Map<number, FrameRequestCallback>();
  let nextFrame = 1;

  const target = {
    innerWidth: width,
    innerHeight: height,
    visualViewport,
    requestAnimationFrame(callback: FrameRequestCallback) {
      const id = nextFrame++;
      frames.set(id, callback);
      return id;
    },
    cancelAnimationFrame: vi.fn((id: number) => frames.delete(id)),
    addEventListener: events.addEventListener.bind(events),
    removeEventListener: events.removeEventListener.bind(events),
  };

  return {
    target,
    visualViewport,
    frames,
    flush() {
      const pending = [...frames.entries()];
      frames.clear();
      pending.forEach(([, callback]) => callback(0));
    },
  };
}

describe("visual viewport variables", () => {
  it("calculates the visual height and keyboard inset", () => {
    expect(
      visualViewportSnapshot({
        innerWidth: 390,
        innerHeight: 844,
        visualViewport: new FakeVisualViewport(390, 504, 12),
      }),
    ).toMatchObject({
      width: 390,
      height: 504,
      offsetTop: 12,
      keyboardInset: 328,
    });
  });

  it("coalesces events into one frame and announces mode changes", () => {
    const h = harness();
    const root = document.createElement("div");
    const changed = vi.fn();
    root.addEventListener(EDITOR_LAYOUT_EVENT, changed);

    const cleanup = installVisualViewportCssVariables(root, h.target);
    h.visualViewport.dispatchEvent(new Event("resize"));
    h.visualViewport.dispatchEvent(new Event("scroll"));
    expect(h.frames.size).toBe(1);

    h.flush();
    expect(root.style.getPropertyValue("--oc-visual-height")).toBe("844px");
    expect(root.style.getPropertyValue("--oc-layout-height")).toBe("844px");
    expect(root.dataset.editorLayout).toBe("continuous");
    expect(changed).toHaveBeenCalledTimes(1);

    h.visualViewport.width = 1024;
    h.visualViewport.height = 768;
    h.target.innerWidth = 1024;
    h.target.innerHeight = 768;
    h.visualViewport.dispatchEvent(new Event("resize"));
    h.flush();
    expect(root.dataset.editorLayout).toBe("paged");
    expect(root.dataset.editorTools).toBe("persistent");
    expect(changed).toHaveBeenCalledTimes(2);

    h.visualViewport.width = 1280;
    h.target.innerWidth = 1280;
    h.visualViewport.dispatchEvent(new Event("resize"));
    h.flush();
    expect(root.dataset.editorLayout).toBe("paged");
    expect(root.dataset.editorNavigator).toBe("persistent");
    expect(changed).toHaveBeenCalledTimes(3);
    cleanup();
  });

  it("removes listeners and cancels a queued frame", () => {
    const h = harness();
    const root = document.createElement("div");
    const cleanup = installVisualViewportCssVariables(root, h.target);

    cleanup();
    expect(h.target.cancelAnimationFrame).toHaveBeenCalledTimes(1);
    h.visualViewport.dispatchEvent(new Event("resize"));
    expect(h.frames.size).toBe(0);
  });
});
