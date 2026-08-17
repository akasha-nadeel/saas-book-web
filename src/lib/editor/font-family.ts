import { Mark, mergeAttributes } from "@tiptap/core";
import { FONTS, fontStack } from "@/lib/typography";

/**
 * An inline font-family mark.
 *
 * The book's face is a per-book setting in the Aa flyout, and it sets the whole
 * manuscript — which is right, because a novel is set in one face. This is for
 * the exception: a letter, a newspaper cutting, a line of code in a thriller,
 * anything the story wants in a different type from the prose around it.
 *
 * Modelled on the font-size mark beside it, and for the same reason: it stores
 * an *id* from the book's own list of faces rather than a stack, so the two
 * places a face can be chosen speak the same language and a face renamed in
 * `typography.ts` does not leave stale CSS in old chapters.
 *
 * The mark reaches the export IR (`blocks.ts` → `xhtml.ts`), so the face holds
 * in the reading view, the EPUB and the print PDF — and, since 2026-08-18, in
 * the Word file too. It did not for most of this app's life, and inline size
 * had the same gap: a passage a writer had set in another face came back from
 * Word looking like every other paragraph, silently, in the one format an agent
 * asks for. `docxFontName` in `export/docx.ts` is the join — a `.docx` names one
 * font per run where CSS takes a whole stack.
 */

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    fontFamily: {
      /** Apply a face by id from FONTS, or null to return to the book's own. */
      setFontFamily: (id: string | null) => ReturnType;
    };
  }
}

/** Whether an id names a face the book knows. Anything else is dropped rather
 *  than written into the document — stored chapters outlive this list. */
export function isKnownFont(id: unknown): id is string {
  return typeof id === "string" && FONTS.some((f) => f.id === id);
}

/** The CSS an id renders as. Shared with the export IR so the editor, the
 *  reader and the output all set the face the same way. */
export function fontFamilyCss(id: string): string {
  return fontStack(id);
}

export const FontFamily = Mark.create({
  name: "fontFamily",

  addAttributes() {
    return {
      font: {
        default: null as string | null,
        // Read back from the id kept on the element, not from the rendered
        // stack: a stack is a list of fallbacks that browsers rewrite, and
        // matching one back to a face is guesswork.
        parseHTML: (element: HTMLElement) => {
          const id = element.getAttribute("data-font");
          return isKnownFont(id) ? id : null;
        },
        renderHTML: (attributes: { font?: string | null }) =>
          isKnownFont(attributes.font)
            ? {
                "data-font": attributes.font,
                style: `font-family: ${fontFamilyCss(attributes.font)}`,
              }
            : {},
      },
    };
  },

  parseHTML() {
    return [
      {
        tag: "span[data-font]",
        getAttrs: (element) =>
          element instanceof HTMLElement && isKnownFont(element.dataset.font)
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
      setFontFamily:
        (id) =>
        ({ chain }) =>
          isKnownFont(id)
            ? chain().setMark("fontFamily", { font: id }).run()
            : chain().unsetMark("fontFamily").run(),
    };
  },
});
