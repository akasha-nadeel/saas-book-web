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
    const chaptersImg = markup.indexOf('src="/icons/icon-chapters.png"');
    const chaptersButton = markup.match(
      /<button[^>]*aria-label="Choose a chapter\. Current chapter: Chapter Three"[^>]*>.*?<\/button>/,
    )?.[0];
    const displayedTitle = markup.lastIndexOf("Chapter Three");

    expect(homeControl).toBeLessThan(chaptersControl);
    expect(chaptersControl).toBeLessThan(chaptersImg);
    expect(chaptersImg).toBeLessThan(displayedTitle);
    expect(chaptersButton).toContain('src="/icons/icon-chapters.png"');
  });
});
