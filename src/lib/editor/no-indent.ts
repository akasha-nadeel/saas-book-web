import { Extension } from "@tiptap/core";

/**
 * A paragraph that begins flush at the margin instead of carrying the book's
 * first-line indent.
 *
 * This exists because a first-line indent is a convention for prose that
 * *flows*: it marks where one paragraph ends and the next begins in a run of
 * body text. A line the writer *placed* — by double-clicking a blank part of the
 * page, see lib/editor/click-to-type.ts — is not part of that run. It has to
 * begin exactly where the caret was shown, or the words jump a quarter-inch
 * right the moment they are typed.
 *
 * Kept apart from alignment, which was the obvious place to hang it and the
 * wrong one: aligning a body paragraph left is an ordinary thing to do to
 * flowing prose and must leave its indent alone. The two questions only look
 * alike. So this is a mark of its own, and it rides as an inline `text-indent`,
 * which beats any stylesheet rule and so needs no CSS of its own in the editor,
 * the reading view, or the exports.
 */

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    noIndent: {
      /** Begin this block at the margin, with no first-line indent. */
      setNoIndent: () => ReturnType;
      /** Give it back the book's first-line indent. */
      unsetNoIndent: () => ReturnType;
    };
  }
}

const TYPES = ["paragraph", "heading"];

export const NoIndent = Extension.create({
  name: "noIndent",

  addGlobalAttributes() {
    return [
      {
        types: TYPES,
        attributes: {
          noIndent: {
            default: false,
            // Zero is zero however it is spelled — "0", "0px", "0em" all mean
            // the same flush line, and pasted markup uses all three.
            parseHTML: (element: HTMLElement) => {
              const indent = element.style.textIndent.trim();
              return indent !== "" && parseFloat(indent) === 0;
            },
            renderHTML: (attributes: { noIndent?: boolean }) =>
              attributes.noIndent ? { style: "text-indent: 0" } : {},
          },
        },
      },
    ];
  },

  addCommands() {
    return {
      setNoIndent:
        () =>
        ({ commands }) =>
          // `some`, not `every`: a paragraph-only selection makes the heading
          // update a no-op, which must not count as the command failing. Same
          // reasoning as TextAlign — see text-align.ts.
          TYPES.map((type) =>
            commands.updateAttributes(type, { noIndent: true }),
          ).some((applied) => applied),

      unsetNoIndent:
        () =>
        ({ commands }) =>
          TYPES.map((type) =>
            commands.updateAttributes(type, { noIndent: false }),
          ).some((applied) => applied),
    };
  },
});
