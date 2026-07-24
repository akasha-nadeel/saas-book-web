import Image from "@tiptap/extension-image";
import { ReactNodeViewRenderer } from "@tiptap/react";
import { ImageNodeView } from "@/components/editor/image-node-view";

/**
 * The book's image node: the standard Tiptap image, given a width and an
 * alignment so it can be handled the way a word processor handles a picture.
 *
 * Width is stored as a percentage of the text column (so it stays proportional
 * whatever the trim size), and alignment as which side of the column it sits on.
 * Both persist in the document, so the reader and the export lay the image out
 * the same as the editor. A React node view draws the resize handles.
 */
export const ResizableImage = Image.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      width: {
        default: null as string | null,
        parseHTML: (element) =>
          element.getAttribute("data-width") || element.style.width || null,
        renderHTML: (attributes) => {
          const width = attributes.width as string | null;
          if (!width) return {};
          return { "data-width": width, style: `width: ${width}` };
        },
      },
      align: {
        default: "center",
        parseHTML: (element) =>
          element.getAttribute("data-align") ||
          (element.parentElement?.style.textAlign as string) ||
          "center",
        renderHTML: (attributes) => ({
          "data-align": (attributes.align as string) || "center",
        }),
      },
    };
  },

  addNodeView() {
    return ReactNodeViewRenderer(ImageNodeView);
  },
});
