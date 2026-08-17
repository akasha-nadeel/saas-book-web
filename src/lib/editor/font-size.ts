import { Mark, mergeAttributes } from "@tiptap/core";

/**
 * An inline font-size mark.
 *
 * Headings are block-level — they resize a whole paragraph — so they cannot make
 * just a few selected words bigger. This mark can: it wraps the selection in a
 * span whose size is a multiple of the book's body size, leaving the rest of the
 * paragraph alone, the way a word processor's grow/shrink buttons do.
 *
 * The size is measured against `--ms-size` (the body size the book is set in)
 * rather than `em`, so it does not compound when the selection already sits in a
 * heading, and it scales with the book's text size. In export, where `--ms-size`
 * is not set, it falls back to `1em` — the element's own size — which is the
 * body size there, so the multiple still holds.
 *
 * Its own mark rather than the TextStyle extension: one attribute, one span, no
 * extra dependency.
 */

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    fontSize: {
      /** Apply an inline size as a multiple of the body size, or null to clear. */
      setFontSize: (size: number | null) => ReturnType;
    };
  }
}

/** The CSS a size multiple renders as. Shared with the export block IR so the
 *  editor, the reader and the print/EPUB output all set the size the same way. */
export function fontSizeCss(multiple: number): string {
  return `calc(var(--ms-size, 1em) * ${multiple})`;
}

export const FontSize = Mark.create({
  name: "fontSize",

  addAttributes() {
    return {
      size: {
        default: null as number | null,
        parseHTML: (element: HTMLElement) => {
          const match = /\*\s*([\d.]+)\s*\)/.exec(element.style.fontSize || "");
          return match ? Number(match[1]) : null;
        },
        renderHTML: (attributes: { size?: number | null }) =>
          attributes.size ? { style: `font-size: ${fontSizeCss(attributes.size)}` } : {},
      },
    };
  },

  parseHTML() {
    return [
      {
        tag: "span",
        getAttrs: (element) =>
          element instanceof HTMLElement && element.style.fontSize
            ? {}
            : false,
      },
    ];
  },

  renderHTML({ HTMLAttributes }) {
    return ["span", mergeAttributes(HTMLAttributes), 0];
  },

  addCommands() {
    return {
      setFontSize:
        (size) =>
        ({ chain }) =>
          size
            ? chain().setMark("fontSize", { size }).run()
            : chain().unsetMark("fontSize").run(),
    };
  },
});

/**
 * The multiples the size list offers. 1 is the body size itself — choosing it
 * clears the mark rather than storing a redundant one.
 */
export const FONT_SIZE_STEPS = [0.85, 1, 1.15, 1.3, 1.5, 1.75, 2, 2.5] as const;

/** One row of the size list. */
export interface FontSizeOption {
  /** What to store. **Null is the body size**, which clears the mark. */
  multiple: number | null;
  /** What to print, in points, against this book's own body size. */
  pt: number;
  /** Whether this row is the body size, which the list says so on. */
  body: boolean;
}

/**
 * The size list, in points, for a book set at `bodyPt`.
 *
 * **The mark stores a multiple and the list shows points**, which is the whole
 * of why this function exists. A writer thinks in points because that is what
 * every word processor and every one of this app's own type controls says
 * (`TEXT_SIZES` in `typography.ts`); the document has to store a ratio, or a
 * run would keep its absolute size when the book's body size moved and the
 * page would come apart. Resolving one into the other at the moment of drawing
 * means the label cannot go stale: the same 1.5× run reads 18 pt in a 12 pt
 * book and 21 pt in a 14 pt one, and both are true.
 *
 * Rounded to a whole point. The scale is multiplicative, so it lands on halves
 * and thirds of a point that mean nothing to anybody choosing a size — and the
 * *stored* value is untouched by this, so nothing is lost to the rounding.
 */
export function fontSizeOptions(bodyPt: number): FontSizeOption[] {
  return FONT_SIZE_STEPS.map((multiple) => ({
    multiple: multiple === 1 ? null : multiple,
    pt: fontSizePt(bodyPt, multiple === 1 ? null : multiple),
    body: multiple === 1,
  }));
}

/**
 * What a stored multiple comes to, in points, in a book set at `bodyPt`.
 *
 * Takes the mark's own value — `null` meaning no mark, which is the body size —
 * so the trigger can print **the size the selection really is** rather than the
 * nearest row of the list. A document can carry an off-scale multiple (an
 * import, or a chapter written before this scale existed), and rounding that to
 * the closest offered size on the control that reports it would be the screen
 * quietly misreporting the document.
 */
export function fontSizePt(bodyPt: number, multiple: number | null): number {
  return Math.round(bodyPt * (multiple ?? 1));
}
