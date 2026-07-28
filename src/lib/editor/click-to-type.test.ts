import { describe, expect, it } from "vitest";
import { clickToType } from "./click-to-type";
import type { PageGeometry } from "./pagination";

// US Letter at 96px to the inch, with one-inch margins: a 816×1056 sheet whose
// text area runs from y=96 to y=960 and x=96 to x=720.
const G: PageGeometry = {
  pageW: 816,
  pageH: 1056,
  mT: 96,
  mB: 96,
  mL: 96,
  mR: 96,
  contentH: 864,
  gap: 24,
};

/** One line of body text, chosen so a page holds a round 36 of them. */
const LINE = 24;

describe("clickToType — how far the caret drops", () => {
  it("counts the whole lines between the prose and the click", () => {
    // Prose ends at y=300; clicking at y=420 is five 24px lines below it.
    expect(clickToType(200, 420, 300, LINE, G).lines).toBe(5);
  });

  it("floors rather than rounds, so the caret never lands past the click", () => {
    // 110px below the foot of the prose is 4.58 lines — four, not five.
    expect(clickToType(200, 410, 300, LINE, G).lines).toBe(4);
  });

  it("gives nothing back for a click above the foot of the prose", () => {
    expect(clickToType(200, 250, 300, LINE, G).lines).toBe(0);
  });

  it("clamps a click in the bottom margin to the last line of the text area", () => {
    // y=1040 is past the text area, which ends at 960: 660px, or 27 lines.
    expect(clickToType(200, 1040, 300, LINE, G).lines).toBe(27);
  });

  it("clamps a click on the desk between two sheets", () => {
    // The gap after page one (1056–1080) is not a place text can go; it reads as
    // the foot of page one, the same as the bottom margin above it.
    expect(clickToType(200, 1070, 300, LINE, G).lines).toBe(27);
  });

  it("counts only text area, not margins, when the click is a page further on", () => {
    // Prose ends 300 down page one (8.5 lines below its text top, so 27.5 lines
    // are left); the click is 240px into page two's text area, ten lines down.
    // 27.5 + 10 floors to 37 — far less than the raw 1116px between them.
    const y = G.pageH + G.gap + G.mT + 240;
    expect(clickToType(200, y, 300, LINE, G).lines).toBe(37);
  });

  it("never drops more than a page of lines", () => {
    // A geometry gone stale mid-repaginate must not insert a thousand blanks.
    expect(clickToType(200, 50_000, 300, LINE, G).lines).toBe(37);
  });

  it("drops nothing when the line height could not be measured", () => {
    expect(clickToType(200, 900, 300, 0, G).lines).toBe(0);
    expect(clickToType(200, 900, 300, Number.NaN, G).lines).toBe(0);
  });
});

describe("clickToType — where across the column", () => {
  // The text column runs x=96 to x=720, so its thirds break at 304 and 512.
  it("left-aligns the left third, so the words begin at the margin", () => {
    // Explicit rather than null: the explicit alignment is what drops the
    // book's first-line indent, and the indent is what would otherwise start
    // the text a quarter-inch in from the spot that was clicked.
    expect(clickToType(100, 400, 300, LINE, G).align).toBe("left");
    expect(clickToType(300, 400, 300, LINE, G).align).toBe("left");
  });

  it("centres a click in the middle third", () => {
    expect(clickToType(408, 400, 300, LINE, G).align).toBe("center");
  });

  it("right-aligns a click in the right third", () => {
    expect(clickToType(700, 400, 300, LINE, G).align).toBe("right");
  });

  it("clamps a click outside the column to its nearest edge", () => {
    expect(clickToType(-50, 400, 300, LINE, G).align).toBe("left");
    expect(clickToType(5_000, 400, 300, LINE, G).align).toBe("right");
  });

  it("still gives an alignment when the drop could not be measured", () => {
    // The caret goes to the end of the prose, but where across the column the
    // writer clicked is known regardless, and still worth honouring.
    expect(clickToType(408, 900, 300, 0, G).align).toBe("center");
  });
});
