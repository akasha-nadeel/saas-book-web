import { describe, expect, it } from "vitest";
import type { Block } from "./blocks";
import {
  dataUrlType,
  isCoreImageType,
  needsRecoding,
  recodeBlocks,
  recodeDataUrl,
} from "./image-recode";

/**
 * Which pictures need converting on the way into an EPUB.
 *
 * The conversion itself is a canvas and cannot run here — jsdom has no image
 * decoder — so what is tested is the half that decides, plus the promise that
 * matters most when the decoder is absent: **nothing is destroyed**. Every
 * failure path returns the picture exactly as it came, which is what lets
 * `packageable` refuse it and `undecodableImages` count it rather than the
 * export dying over one illustration.
 */

const image = (src: string): Block => ({
  kind: "image",
  depth: 0,
  src,
  runs: [],
});

const WEBP = "data:image/webp;base64,UklGRhoAAAA=";
const PNG = "data:image/png;base64,iVBORw0KGgo=";

describe("what the package may carry as it stands", () => {
  it("names the four types EPUB 3 requires a reader to understand", () => {
    for (const type of ["image/jpeg", "image/png", "image/gif", "image/svg+xml"]) {
      expect(isCoreImageType(type)).toBe(true);
    }
  });

  it("does not include WebP, whatever the browser can do with it", () => {
    /* This is the whole bug. WebP is not a core media type, so a manifest entry
       declaring it is a foreign resource with no fallback — and a reading
       system that skips it is behaving correctly. */
    expect(isCoreImageType("image/webp")).toBe(false);
    expect(needsRecoding(WEBP)).toBe(true);
  });

  it("leaves a picture that is already core alone", () => {
    expect(needsRecoding(PNG)).toBe(false);
  });

  it("is case-insensitive about the media type", () => {
    // A data URL written by another tool is under no obligation to be lower-case.
    expect(isCoreImageType("IMAGE/PNG")).toBe(true);
    expect(dataUrlType("DATA:image/PNG;base64,AA")).toBe(null);
    expect(dataUrlType("data:IMAGE/PNG;base64,AA")).toBe("image/png");
  });

  it("says nothing about a src that is not a data URL", () => {
    /* A package path or a remote picture is somebody else's problem: the first
       is already a resource, and the second EPUB forbids outright under any
       declaration. Neither is something to convert. */
    expect(needsRecoding("images/plate-1.png")).toBe(false);
    expect(needsRecoding("https://example.com/plate.webp")).toBe(false);
    expect(dataUrlType("images/plate-1.png")).toBe(null);
  });
});

describe("when the picture cannot be converted", () => {
  it("hands back exactly what it was given", async () => {
    /* There is no image decoder in this environment, so every call takes the
       failure path — which is the path that must not lose anything. A picture
       returned unchanged is refused by `packageable` and counted by
       `undecodableImages`; a picture returned mangled would be zipped. */
    expect(await recodeDataUrl(WEBP)).toBe(WEBP);
    expect(await recodeDataUrl(PNG)).toBe(PNG);
  });

  it("leaves the blocks alone rather than rebuilding them", async () => {
    const blocks = [[image(PNG)], [image(WEBP)]];
    const out = await recodeBlocks(blocks);

    expect(out[0][0].src).toBe(PNG);
    expect(out[1][0].src).toBe(WEBP);
  });

  it("never throws, whatever it is handed", async () => {
    // An export that dies over one broken illustration loses the book.
    await expect(recodeDataUrl("data:image/webp;base64,????")).resolves.toBe(
      "data:image/webp;base64,????",
    );
    await expect(recodeBlocks([])).resolves.toEqual([]);
  });
});
