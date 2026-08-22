import { describe, expect, it } from "vitest";
import { caretScrollDelta, visibleEditingPort } from "./caret-scroll";

// A window on the text 600px tall, with a line of room kept at each edge.
const PORT = { top: 100, bottom: 700 };
const PAD = 30;

describe("caretScrollDelta", () => {
  it("does not move while the caret is comfortably inside", () => {
    expect(caretScrollDelta({ top: 300, bottom: 330 }, PORT, PAD)).toBe(0);
    // This is the whole point: typing in the middle of the page must not move
    // it at all, so the words under the cursor stay where the eye left them.
    expect(caretScrollDelta({ top: 131, bottom: 161 }, PORT, PAD)).toBe(0);
    expect(caretScrollDelta({ top: 639, bottom: 669 }, PORT, PAD)).toBe(0);
  });

  it("moves by exactly the overshoot when the caret passes the foot", () => {
    // Bottom edge for the caret is 670. A caret ending at 682 is 12px past it,
    // so the page moves 12px — not a screenful, and not to recentre.
    expect(caretScrollDelta({ top: 652, bottom: 682 }, PORT, PAD)).toBe(12);
  });

  it("moves by exactly the overshoot when the caret passes the head", () => {
    // Top edge is 130; a caret starting at 118 is 12px above it.
    expect(caretScrollDelta({ top: 118, bottom: 148 }, PORT, PAD)).toBe(-12);
  });

  it("brings a caret far below back to the foot, no further", () => {
    // Backspacing or a page break can leave the caret well past the edge. It
    // returns to the edge, so the line being written sits at the bottom — the
    // page never scrolls past what the writer is doing.
    expect(caretScrollDelta({ top: 1170, bottom: 1200 }, PORT, PAD)).toBe(530);
  });

  it("brings a caret far above back to the head", () => {
    expect(caretScrollDelta({ top: -200, bottom: -170 }, PORT, PAD)).toBe(-330);
  });

  it("settles on the top when the caret is taller than the port allows", () => {
    // A caret taller than the padded window breaches both edges at once. It has
    // to pick one and stay there: fixing the foot would breach the head, and the
    // two corrections would fight each frame.
    expect(caretScrollDelta({ top: 120, bottom: 900 }, PORT, PAD)).toBe(-10);
  });

  it("treats the edges as inclusive, so a caret resting on one is left alone", () => {
    expect(caretScrollDelta({ top: 130, bottom: 160 }, PORT, PAD)).toBe(0);
    expect(caretScrollDelta({ top: 640, bottom: 670 }, PORT, PAD)).toBe(0);
  });

  it("keeps the caret visible when a mobile keyboard reduces the editor height", () => {
    const keyboardPort = { top: 56, bottom: 356 };
    expect(
      caretScrollDelta({ top: 342, bottom: 374 }, keyboardPort, 2),
    ).toBe(20);
    expect(
      caretScrollDelta({ top: 250, bottom: 282 }, keyboardPort, 2),
    ).toBe(0);
  });

  it("holds still until the caret has actually run out of room", () => {
    // The pad the editor really uses is 2px, not a line's height. Padding by a
    // line moves the page while the caret is still plainly visible, which is
    // read — correctly — as the page moving on its own.
    const EDGE = 2;
    // A whole line still to go: nothing moves.
    expect(caretScrollDelta({ top: 638, bottom: 668 }, PORT, EDGE)).toBe(0);
    // Its last line, sitting on the edge: still nothing.
    expect(caretScrollDelta({ top: 668, bottom: 698 }, PORT, EDGE)).toBe(0);
    // Only once it would be cut off does the page give way, by the overshoot.
    expect(caretScrollDelta({ top: 670, bottom: 700 }, PORT, EDGE)).toBe(2);
  });
});

describe("visibleEditingPort", () => {
  it("clips the scroll container to the visual viewport and mobile chrome", () => {
    expect(
      visibleEditingPort(
        { top: 0, bottom: 800 },
        { top: 12, bottom: 412 },
        68,
        348,
      ),
    ).toEqual({ top: 68, bottom: 348 });
  });

  it("uses the container edges when no overlay chrome is present", () => {
    expect(
      visibleEditingPort(
        { top: 80, bottom: 720 },
        { top: 0, bottom: 900 },
      ),
    ).toEqual({ top: 80, bottom: 720 });
  });
});
