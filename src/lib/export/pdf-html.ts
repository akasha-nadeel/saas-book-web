import { escapeXml } from "./xhtml";

/**
 * The whole book as one standalone HTML document, for a browser that has
 * nothing else on it.
 *
 * **This is the half of the PDF that leaves the machine**, and it is worth
 * being plain about why the export moved: rendered in an iframe on the writer's
 * own machine, the contents page printed a folio of `0` beside every chapter.
 * Paged.js resolves those numbers by asking `window.getComputedStyle(page)` —
 * the *top* window — about elements that live inside the frame, which answers
 * nothing, so it counts up from zero and stops there. Nothing in our own code
 * could fix that while the pages were in a frame. Rendered as its own document
 * there is no frame, the numbers resolve, and the writer stops meeting a print
 * dialog they never asked for.
 *
 * Pure and tested, so the one thing the route does that is not Chrome's doing
 * can be checked without launching a browser.
 */
export function printHtml({
  content,
  css,
  title,
}: {
  /** The book's markup — `printDocument`'s `content`. */
  content: string;
  /** The book's stylesheet — `printDocument`'s `css`. */
  css: string;
  title: string;
}): string {
  /*
   * **`PagedConfig` goes in before the polyfill, and that ordering is the
   * whole handshake.** Paged.js reads `window.PagedConfig` when it loads and
   * runs itself; the `after` hook is the only honest signal that pagination
   * has finished, and the route waits on the flag it sets rather than on a
   * timer. A timer would either cut a long book off mid-layout or make every
   * short one wait for the worst case.
   */
  return `<!doctype html>
<html>
<head>
<meta charset="utf-8"/>
<title>${escapeXml(title)}</title>
<style>${css}</style>
<script>
  window.PagedConfig = {
    auto: true,
    after: function () { window.__ocPagedDone = true; },
  };
</script>
</head>
<body>${content}</body>
</html>`;
}
