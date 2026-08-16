import { describe, expect, it } from "vitest";
import type { Block } from "./blocks";
import {
  extractImages,
  packageCover,
  packageable,
  undecodableImages,
} from "./epub-images";

/** A 1×1 transparent GIF — the smallest real image there is. */
const GIF =
  "data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7";
/** A 1×1 PNG. */
const PNG =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==";

const image = (src: string): Block => ({
  kind: "image",
  depth: 0,
  src,
  runs: [],
});

const para = (text: string): Block => ({
  kind: "paragraph",
  depth: 0,
  runs: [{ text }],
});

describe("extractImages", () => {
  it("lifts a data URL into a package resource and rewrites the src", () => {
    const { blocks, images } = extractImages([[image(GIF)]]);

    expect(images).toHaveLength(1);
    expect(images[0]).toMatchObject({
      id: "img-01",
      href: "images/img-01.gif",
      mediaType: "image/gif",
    });
    expect(images[0].bytes.length).toBeGreaterThan(0);
    expect(blocks[0][0].src).toBe("images/img-01.gif");
  });

  it("stores a repeated image once and points both blocks at it", () => {
    // The scene-break ornament case: the same bytes in two chapters must not
    // become two files, or a forty-chapter book carries forty copies.
    const { blocks, images } = extractImages([[image(GIF)], [image(GIF)]]);

    expect(images).toHaveLength(1);
    expect(blocks[0][0].src).toBe("images/img-01.gif");
    expect(blocks[1][0].src).toBe("images/img-01.gif");
  });

  it("numbers distinct images in order across chapters", () => {
    const { images } = extractImages([[image(GIF)], [image(PNG)]]);

    expect(images.map((i) => i.href)).toEqual([
      "images/img-01.gif",
      "images/img-02.png",
    ]);
  });

  it("leaves non-image blocks and already-packaged srcs alone", () => {
    const { blocks, images } = extractImages([
      [para("prose"), image("images/img-01.png")],
    ]);

    expect(images).toHaveLength(0);
    expect(blocks[0][1].src).toBe("images/img-01.png");
  });

  it("keeps the src when the payload cannot be decoded", () => {
    // Better a file that fails validation on one image than a book that
    // silently lost a picture the writer put there.
    const broken = "data:image/png;base64,!!!not base64!!!";
    const { blocks, images } = extractImages([[image(broken)]]);

    expect(images).toHaveLength(0);
    expect(blocks[0][0].src).toBe(broken);
  });

  it("declines a media type EPUB does not carry as a core type", () => {
    const tiff = "data:image/tiff;base64,SUkqAA==";
    const { blocks, images } = extractImages([[image(tiff)]]);

    expect(images).toHaveLength(0);
    expect(blocks[0][0].src).toBe(tiff);
  });

  it("declines a data URL that is not base64", () => {
    const plain = "data:image/svg+xml,%3Csvg%2F%3E";
    const { images } = extractImages([[image(plain)]]);

    expect(images).toHaveLength(0);
  });

  it("does not mutate the blocks it was given", () => {
    const original = image(GIF);
    extractImages([[original]]);

    expect(original.src).toBe(GIF);
  });
});

describe("packageCover", () => {
  it("takes the fixed cover-image id both manifest hooks point at", () => {
    const cover = packageCover(PNG);

    expect(cover).toMatchObject({
      id: "cover-image",
      href: "images/cover.png",
      mediaType: "image/png",
    });
  });

  it("returns null for a missing or unusable cover", () => {
    expect(packageCover(null)).toBeNull();
    expect(packageCover("not a data url")).toBeNull();
    expect(packageCover("data:image/tiff;base64,SUkqAA==")).toBeNull();
  });
});

/*
 * **These decide what is in somebody's book**, and each `false` below is a
 * picture the EPUB leaves out rather than a hard EPUBCheck failure the shop
 * finds first. Three renderers ask this one question — the packager, the
 * pre-upload check and the wizard's preview — so it may not be re-derived
 * anywhere.
 */
describe("packageable", () => {
  it("takes a data URL of a core media type", () => {
    expect(packageable(image(PNG))).toBe(true);
    expect(packageable(image(GIF))).toBe(true);
  });

  it("refuses a payload that will not decode", () => {
    // A core type with a corrupt payload would otherwise pass a header sniff
    // and fail in extraction, leaving an <img> pointing at a file nothing
    // wrote — RSC-007, a broken reference.
    expect(packageable(image("data:image/png;base64,???"))).toBe(false);
  });

  it("refuses a media type EPUB has no core support for", () => {
    // ERROR(RSC-032): a foreign resource needs a fallback, and an inline
    // illustration is not worth that machinery.
    expect(packageable(image("data:image/tiff;base64,SUkqAA=="))).toBe(false);
  });

  it("refuses a picture linked from the web", () => {
    // ERROR(RSC-006): EPUB 3.3 allows a remote audio, video or font and never
    // a remote <img>, so there is nothing to declare that would make it legal.
    expect(packageable(image("https://example.com/plate.png"))).toBe(false);
  });

  it("refuses a path that merely looks like one of ours", () => {
    // A book imported *from* an EPUB arrives carrying that package's own
    // `images/…` paths in its prose, referring to files never brought across.
    expect(packageable(image("images/plate-1.png"))).toBe(false);
  });

  it("is false for anything that is not a picture", () => {
    expect(packageable(para("x"))).toBe(false);
  });
});

describe("undecodableImages", () => {
  it("counts every image the package cannot carry", () => {
    const count = undecodableImages([
      [
        image(PNG),
        image("data:image/png;base64,???"),
        image("data:image/tiff;base64,SUkqAA=="),
        image("https://example.com/plate.png"),
        para("x"),
      ],
    ]);

    expect(count).toBe(3);
  });

  it("counts nothing when every image can be packaged", () => {
    expect(undecodableImages([[image(PNG), image(GIF)]])).toBe(0);
  });
});
