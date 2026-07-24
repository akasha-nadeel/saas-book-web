import { Extension } from "@tiptap/core";

/**
 * Per-paragraph text alignment.
 *
 * Alignment is a property of a block, not of a run — you align a whole paragraph
 * (or heading), the way a word processor does, not a few selected words. So this
 * adds a `textAlign` attribute to the paragraph and heading nodes and renders it
 * as an inline `text-align`, which overrides the book's default alignment for
 * just those blocks.
 *
 * A small extension of its own rather than the TextAlign package: the same
 * attribute and two commands, no extra dependency.
 */

export type TextAlignValue = "left" | "center" | "right" | "justify";

const TYPES = ["paragraph", "heading"];
const ALIGNMENTS: TextAlignValue[] = ["left", "center", "right", "justify"];

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    textAlign: {
      setTextAlign: (alignment: TextAlignValue) => ReturnType;
      unsetTextAlign: () => ReturnType;
    };
  }
}

export const TextAlign = Extension.create({
  name: "textAlign",

  addGlobalAttributes() {
    return [
      {
        types: TYPES,
        attributes: {
          textAlign: {
            default: null as TextAlignValue | null,
            parseHTML: (element: HTMLElement) => {
              const align = element.style.textAlign;
              return ALIGNMENTS.includes(align as TextAlignValue)
                ? (align as TextAlignValue)
                : null;
            },
            renderHTML: (attributes: { textAlign?: TextAlignValue | null }) =>
              attributes.textAlign
                ? { style: `text-align: ${attributes.textAlign}` }
                : {},
          },
        },
      },
    ];
  },

  addCommands() {
    return {
      setTextAlign:
        (alignment) =>
        ({ commands }) => {
          if (!ALIGNMENTS.includes(alignment)) return false;
          // Applied to every block type it knows; the ones not in the selection
          // simply do nothing. `some`, not `every`, so a paragraph-only
          // selection (where the heading update is a no-op) still counts as
          // applied — otherwise the command reported failure on ordinary text.
          return TYPES.map((type) =>
            commands.updateAttributes(type, { textAlign: alignment }),
          ).some((applied) => applied);
        },
      unsetTextAlign:
        () =>
        ({ commands }) =>
          TYPES.map((type) =>
            commands.resetAttributes(type, "textAlign"),
          ).some((applied) => applied),
    };
  },
});
