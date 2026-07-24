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
 * The multiples the grow/shrink buttons step through. 1 is the body size itself
 * — reaching it clears the mark rather than storing a redundant one.
 */
export const FONT_SIZE_STEPS = [0.85, 1, 1.15, 1.3, 1.5, 1.75, 2, 2.5] as const;

const BASE_INDEX = FONT_SIZE_STEPS.indexOf(1);

/** The next size up or down from the current one, clamped to the scale. Returns
 *  null for the body size, so the caller clears the mark instead of setting it. */
export function steppedFontSize(
  current: number | null,
  direction: 1 | -1,
): number | null {
  let index =
    current != null ? FONT_SIZE_STEPS.indexOf(current as never) : BASE_INDEX;
  if (index === -1) index = BASE_INDEX;
  const next = Math.min(
    FONT_SIZE_STEPS.length - 1,
    Math.max(0, index + direction),
  );
  const multiple = FONT_SIZE_STEPS[next];
  return multiple === 1 ? null : multiple;
}
