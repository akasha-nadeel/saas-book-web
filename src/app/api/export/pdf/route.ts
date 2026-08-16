import { readFileSync } from "node:fs";
import { join } from "node:path";
import { NextResponse } from "next/server";
import { printHtml } from "@/lib/export/pdf-html";

/**
 * The PDF, rendered by a real browser that has nothing on it but the book.
 *
 * **This is the one route the manuscript travels on, and it exists because two
 * things could not be fixed on the writer's own machine.** The export used to
 * paginate in a hidden iframe and then hand the browser's print dialog to the
 * writer, which meant:
 *
 * - **Every contents folio printed `0`.** Paged.js works out which page a
 *   chapter landed on with `window.getComputedStyle(page)` — the *top* window —
 *   and the pages were in the frame. Asking one document about another's
 *   elements answers nothing, so it counted from zero and stopped. Measured,
 *   and not fixable from our side: we carried its stylesheets across correctly
 *   and the numbers were still zero, because the numbers were computed wrong
 *   before they were written down.
 * - **A print dialog is not an export.** Whether anything was saved, or under
 *   what name, was never knowable — which is why `runExport` answered `null`
 *   for PDF and the writer got no confirmation at all.
 *
 * Rendered as its own document neither is true any more: there is no frame, so
 * the folios resolve, and what comes back is bytes we can hand over and name.
 *
 * **What is sent is the typeset book** — the same markup and stylesheet
 * `printDocument` hands Paged.js. `/privacy` names it, and the export screen
 * says so before the press. Nothing is stored: the file is built, returned and
 * the browser is closed.
 */

export const runtime = "nodejs";
/** A long book is a minute of layout. The platform's own ceiling is 300. */
export const maxDuration = 300;

/**
 * Paged.js, read off disk and injected — the same build the browser uses.
 *
 * **By path rather than by `require.resolve`, and that is not a shortcut.**
 * The package's `exports` map is conditions-only (`import`, `require`,
 * `browser`, `polyfill`) with no path subentries, so
 * `pagedjs/dist/paged.polyfill.js` is not a resolvable specifier at all — the
 * bundler refuses it before this ever runs. Read once and kept: it is most of
 * a megabyte and every export would otherwise pay for it again.
 *
 * `next.config.ts` names this file in `outputFileTracingIncludes`, because
 * nothing imports it and a tracer only packs what it can see.
 */
let polyfill: string | null = null;
function pagedPolyfill(): string {
  if (polyfill !== null) return polyfill;
  /* `OC_PAGEDJS_DIST` is resolved at build time in `next.config.ts`, where the
     same package is already being located for the browser bundle and hoisting
     is handled. The fallback is for anything that runs this file without that
     config — a test, a script — and is the ordinary layout. */
  const dist =
    process.env.OC_PAGEDJS_DIST ||
    join(process.cwd(), "node_modules", "pagedjs", "dist");
  polyfill = readFileSync(join(dist, "paged.polyfill.js"), "utf8");
  return polyfill;
}

/**
 * Where Chrome is.
 *
 * Three answers because there are three places this runs. `CHROME_PATH` is the
 * explicit one and wins — it is what a self-hosted copy and a developer's
 * machine set. Otherwise the serverless build ships its own binary. Both are
 * optional: with neither, the route answers 501 and the client falls back to
 * the print dialog it used before, so a copy of this app with no Chrome behind
 * it exports exactly as it always did.
 */
async function chrome(): Promise<{
  executablePath: string;
  args: string[];
  headless: boolean;
} | null> {
  const explicit = process.env.CHROME_PATH?.trim();
  if (explicit) {
    return { executablePath: explicit, args: [], headless: true };
  }

  try {
    const chromium = (await import("@sparticuz/chromium")).default;
    const executablePath = await chromium.executablePath();
    if (!executablePath) return null;
    return { executablePath, args: chromium.args, headless: true };
  } catch {
    return null;
  }
}

interface Body {
  content?: unknown;
  css?: unknown;
  title?: unknown;
  /** The trim, in inches — see `pageSize`. */
  width?: unknown;
  height?: unknown;
}

/**
 * The sheet the PDF is written on, in inches.
 *
 * **Told, not inferred, and that is the whole of this function.** It relied on
 * Chrome's `preferCSSPageSize`, which reads the `@page` rule off the document —
 * and Paged.js does not leave that rule alone: it consumes the page rules and
 * writes its own, and once chapters were given a *named* page (`@page
 * chapter:first`, which is what keeps the running head off a chapter opening)
 * Chrome stopped finding a size it recognised and quietly fell back to its
 * default. That default is A4, so a book set at 6×9 came out on office paper —
 * measured, `/MediaBox 0 0 594.96 841.92` on a file whose stylesheet plainly
 * said `size: 6in 9in`. It fails silently and it fails towards a page size that
 * looks deliberate, which is the worst combination.
 *
 * The client knows the trim exactly, so it sends it. Anything missing or
 * unreasonable falls back to the commonest trim rather than to Chrome's idea of
 * paper.
 */
function pageSize(body: Body): { width: string; height: string } {
  const inches = (value: unknown, fallback: number) =>
    typeof value === "number" && Number.isFinite(value) && value > 1 && value < 30
      ? value
      : fallback;
  return {
    width: `${inches(body.width, 6)}in`,
    height: `${inches(body.height, 9)}in`,
  };
}

export async function POST(request: Request) {
  let body: Body;
  try {
    body = (await request.json()) as Body;
  } catch {
    return NextResponse.json({ error: "That was not JSON." }, { status: 400 });
  }

  const { content, css, title } = body;
  if (typeof content !== "string" || typeof css !== "string" || !content) {
    return NextResponse.json(
      { error: "A book needs markup and a stylesheet." },
      { status: 400 },
    );
  }

  const where = await chrome();
  if (!where) {
    /* 501 with a message naming the setting, the shape every optional
       dependency in this app uses. The client falls back to the print dialog,
       so this is a downgrade rather than a failure. */
    return NextResponse.json(
      {
        error:
          "No browser is configured to render a PDF here. Set CHROME_PATH, or use the print dialog.",
      },
      { status: 501 },
    );
  }

  const { default: puppeteer } = await import("puppeteer-core");
  let browser: Awaited<ReturnType<typeof puppeteer.launch>> | null = null;

  try {
    browser = await puppeteer.launch({
      executablePath: where.executablePath,
      args: where.args,
      headless: where.headless,
    });

    const page = await browser.newPage();
    await page.setContent(
      printHtml({
        content,
        css,
        title: typeof title === "string" && title ? title : "Book",
      }),
      // No network to wait for: pictures ride in as data URLs, and the
      // stylesheet is inline. `load` is the last thing that happens.
      { waitUntil: "load" },
    );

    await page.addScriptTag({ content: pagedPolyfill() });
    /* The `after` hook Paged.js calls once pagination has finished — see
       `printHtml`. Waiting on the flag rather than a timer is what lets a
       forty-chapter book take as long as it takes. */
    await page.waitForFunction("window.__ocPagedDone === true", {
      timeout: 240_000,
    });

    const pdf = await page.pdf({
      /* Paged.js has already drawn the page boxes at the trim size, margins
         and all, so Chrome must add none of its own — otherwise every margin
         is applied twice and the text block walks in from the edge. */
      ...pageSize(body),
      /* Off, deliberately: it reads a `@page` rule that Paged.js has already
         rewritten, and gets it wrong once a named page is in play. See
         `pageSize`. */
      preferCSSPageSize: false,
      margin: { top: "0", right: "0", bottom: "0", left: "0" },
      printBackground: true,
    });

    return new NextResponse(new Uint8Array(pdf), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        // Nothing about a manuscript belongs in a shared cache.
        "Cache-Control": "no-store",
      },
    });
  } catch (err) {
    console.error("[export/pdf] could not render", err);
    return NextResponse.json(
      { error: "That book could not be laid out." },
      { status: 500 },
    );
  } finally {
    // A browser left running is a leaked process per export.
    await browser?.close().catch(() => {});
  }
}
