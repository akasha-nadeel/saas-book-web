import { describe, expect, it } from "vitest";
import type { Block } from "./blocks";
import {
  extractImages,
  packageCover,
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

describe("undecodableImages", () => {
  it("counts the images a store would reject", () => {
    expect(
      undecodableImages([[image("data:image/png;base64,???"), para("x")]]),
    ).toBe(1);
    expect(undecodableImages([[image("images/img-01.png")]])).toBe(0);
  });
});
