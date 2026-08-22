import {
  createElement,
  type AnchorHTMLAttributes,
  type ReactNode,
} from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { MobileEditorHeader } from "./mobile-editor-header";

vi.mock("next/link", () => ({
  default: ({
    children,
    ...props
  }: AnchorHTMLAttributes<HTMLAnchorElement> & { children: ReactNode }) =>
    createElement("a", props, children),
}));

describe("MobileEditorHeader", () => {
  it("places the shared chapters control between Home and the chapter title", () => {
    const markup = renderToStaticMarkup(
      createElement(MobileEditorHeader, {
        chapterTitle: "Chapter Three",
        status: "Saved",
        onChapters: () => undefined,
      }),
    );

    expect(markup).toContain(
      'aria-label="Choose a chapter. Current chapter: Chapter Three"',
    );
    const homeControl = markup.indexOf('aria-label="All books"');
    const chaptersControl = markup.indexOf(
      'aria-label="Choose a chapter. Current chapter: Chapter Three"',
    );
    const chaptersGlyph = markup.indexOf(
      'd="M10 6.4c0-1.1-1.4-1.9-3.8-1.9h-3v9.6h3c2.4 0 3.8.9 3.8 2"',
    );
    const chaptersButton = markup.match(
      /<button[^>]*aria-label="Choose a chapter\. Current chapter: Chapter Three"[^>]*>.*?<\/button>/,
    )?.[0];
    const displayedTitle = markup.lastIndexOf("Chapter Three");

    expect(homeControl).toBeLessThan(chaptersControl);
    expect(chaptersControl).toBeLessThan(chaptersGlyph);
    expect(chaptersGlyph).toBeLessThan(displayedTitle);
    expect(chaptersButton).toContain('stroke-width="1.7"');
    expect(chaptersButton).toContain('class="h-5 w-5"');
    expect(markup).not.toContain('d="m6 8 4 4 4-4"');
  });
});
