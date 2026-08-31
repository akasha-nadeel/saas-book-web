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
    // The mark, by name. It was the PNG's `src` until the rails' bitmaps
    // became drawn marks; what this test is pinning is the *order* of the
    // three controls, so the anchor only has to be something unique to the
    // chapters one — and `data-mark` is on `RailMark` for exactly this, so it
    // cannot go stale the next time a drawing changes.
    const chaptersImg = markup.indexOf('data-mark="chapters"');
    // `[\s\S]` rather than `.`, because the mark's class attribute is a
    // multi-line string and a bare `.` stops at the first newline in it. The
    // `s` flag would say the same thing and needs an es2018 target.
    const chaptersButton = markup.match(
      /<button[^>]*aria-label="Choose a chapter\. Current chapter: Chapter Three"[^>]*>[\s\S]*?<\/button>/,
    )?.[0];
    const displayedTitle = markup.lastIndexOf("Chapter Three");

    expect(homeControl).toBeLessThan(chaptersControl);
    expect(chaptersControl).toBeLessThan(chaptersImg);
    expect(chaptersImg).toBeLessThan(displayedTitle);
    expect(chaptersButton).toContain('data-mark="chapters"');
  });
});
