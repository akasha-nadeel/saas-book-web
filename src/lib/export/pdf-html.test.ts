import { expect, it } from "vitest";
import { printHtml } from "@/lib/export/pdf-html";

const doc = (over: Partial<Parameters<typeof printHtml>[0]> = {}) =>
  printHtml({
    content: "<section><h1>Chapter One</h1></section>",
    css: "body { font-size: 11pt; }",
    title: "The Salt Road",
    ...over,
  });

it("puts the book's own markup and stylesheet in one document", () => {
  const html = doc();

  expect(html.startsWith("<!doctype html>")).toBe(true);
  expect(html).toContain("<style>body { font-size: 11pt; }</style>");
  expect(html).toContain("<section><h1>Chapter One</h1></section>");
});

/*
 * **The config has to be parsed before the polyfill runs**, and the route
 * injects the polyfill after this document is loaded. Paged.js reads
 * `window.PagedConfig` as it starts and never looks again, so a hook written
 * afterwards would never be called and the route would wait on a flag nothing
 * was going to set — a PDF export that hangs until it times out rather than
 * one that fails.
 */
it("declares the completion hook before anything can run", () => {
  const html = doc();

  expect(html).toContain("window.PagedConfig");
  expect(html).toContain("window.__ocPagedDone = true");
  expect(html.indexOf("window.PagedConfig")).toBeLessThan(
    html.indexOf("<body>"),
  );
});

it("escapes the title, which is the writer's own words", () => {
  // It lands in <title>, so an unescaped angle bracket would close the element
  // and put the rest of somebody's book title into the markup.
  const html = doc({ title: 'Salt & <Cedar> "Road"' });

  expect(html).toContain(
    "<title>Salt &amp; &lt;Cedar&gt; &quot;Road&quot;</title>",
  );
});

/*
 * The markup and the stylesheet are this app's own — built by `printDocument`
 * out of the writer's document, with every run already escaped on the way
 * through `blocksToXhtml`. They are placed as-is on purpose: escaping them
 * again would print the tags rather than render them.
 */
it("places the book's markup unescaped, because it is already markup", () => {
  const html = doc({ content: "<p>Ampersand &amp; angle &lt;</p>" });

  expect(html).toContain("<p>Ampersand &amp; angle &lt;</p>");
});
