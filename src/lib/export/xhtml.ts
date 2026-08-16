import type { Block, Run } from "./blocks";

/**
 * Whether XML 1.0 can carry this code unit at all.
 *
 * **The five metacharacters have escapes; these have none.** Not `&#0;`, not a
 * CDATA section, not anything — a character outside XML's `Char` production
 * cannot appear in a document in any form. One of them anywhere in a
 * manuscript makes every XHTML file in the EPUB a *fatal* parse error, which
 * is EPUBCheck's own word for it:
 *
 *     FATAL(RSC-016) An invalid XML character (Unicode: 0xc) was found
 *
 * and a fatal file is refused whole, by every shop and every reader. Nothing
 * upstream stops one arriving. The editor never types a control character, but
 * the importers take whatever is in the file, and a form feed (`0x0C`) is
 * exactly how a plain-text book marks a page break — every Project Gutenberg
 * `.txt` is full of them. So such a manuscript imports cleanly, reads correctly
 * on screen, exports without a word of complaint, and is rejected at the shop.
 *
 * Written as code-unit arithmetic rather than a regular expression because the
 * character class would have to be spelled with escapes for characters that
 * are invisible in a source file, and an editor that helpfully rewrote one into
 * its literal form would leave a lone surrogate sitting in this module.
 */
function carryable(code: number): boolean {
  // Tab, newline and carriage return are the three control characters XML does
  // allow, and they are the only ones a manuscript has any use for.
  if (code < 0x20) return code === 0x09 || code === 0x0a || code === 0x0d;
  if (code >= 0xd800 && code <= 0xdfff) return false; // handled as pairs below
  return code !== 0xfffe && code !== 0xffff;
}

/**
 * Text with the characters XML cannot carry taken out.
 *
 * **Dropped rather than replaced.** A control character carries nothing a
 * reader could want, so there is nothing to stand in for it; a substitute
 * glyph would put visible litter in somebody's prose to mark the absence of
 * something invisible.
 *
 * A whole surrogate *pair* is a real character and survives — that is what
 * leaves an emoji alone while dropping the half of one that lost its partner
 * to a cut that did not count code points. A lone surrogate is a fatal parse
 * error exactly like a NUL.
 *
 * Nothing is allocated when there is nothing to do, which is every manuscript
 * anybody has ever typed: this runs over every run of every block on every
 * pagination pass in the reader, so the common case has to cost a scan and no
 * more. `from === 0` is how it knows nothing was dropped.
 */
export function stripInvalidXml(text: string): string {
  let clean = "";
  /** The start of the run not yet copied — only ever moved by a drop. */
  let from = 0;

  for (let i = 0; i < text.length; i++) {
    const code = text.charCodeAt(i);
    if (code >= 0xd800 && code <= 0xdbff) {
      const low = text.charCodeAt(i + 1);
      // A complete pair: skip both, it is one ordinary character.
      if (low >= 0xdc00 && low <= 0xdfff) {
        i++;
        continue;
      }
    } else if (carryable(code)) {
      continue;
    }
    clean += text.slice(from, i);
    from = i + 1;
  }

  return from === 0 ? text : clean + text.slice(from);
}

/**
 * Ampersand first, or every subsequent replacement double-escapes.
 *
 * Strips first, though: escaping is only meaningful for a character the
 * document can hold at all. Every string that reaches the EPUB, the print
 * document or the reading view comes through here — the prose, the chapter
 * titles, the book's own metadata, every attribute — so this is the one place
 * that has to hold for all of them.
 */
export function escapeXml(text: string): string {
  return stripInvalidXml(text)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function renderRun(run: Run): string {
  if (run.hardBreak) return "<br />";

  let out = escapeXml(run.text);

  if (run.code) out = `<code>${out}</code>`;
  if (run.strike) out = `<s>${out}</s>`;
  if (run.underline) out = `<u>${out}</u>`;
  if (run.italic) out = `<em>${out}</em>`;
  if (run.bold) out = `<strong>${out}</strong>`;
  if (run.fontSize)
    out = `<span style="font-size:${escapeXml(run.fontSize)}">${out}</span>`;
  if (run.fontFamily)
    out = `<span style="font-family:${escapeXml(run.fontFamily)}">${out}</span>`;
  if (run.href) out = `<a href="${escapeXml(run.href)}">${out}</a>`;

  return out;
}

const renderRuns = (runs: Run[]) => runs.map(renderRun).join("");

const isList = (block: Block) =>
  block.kind === "bullet" || block.kind === "ordered";

/**
 * Rebuilds real list nesting from the flat block list.
 *
 * Consumes blocks from `start` while they are list items at `depth` or deeper,
 * and returns the rendered list plus the index it stopped at. A deeper item is
 * folded into the item above it, which is where XHTML requires a sublist to
 * live — the `<li>` wrapping happens last so the sublist ends up inside it.
 */
function renderList(
  blocks: Block[],
  start: number,
  depth: number,
): { html: string; next: number } {
  const tag = blocks[start].kind === "bullet" ? "ul" : "ol";
  const items: string[] = [];
  let i = start;

  while (i < blocks.length && isList(blocks[i]) && blocks[i].depth >= depth) {
    const block = blocks[i];

    if (block.depth > depth) {
      const nested = renderList(blocks, i, block.depth);
      // A list opening deeper than its parent has no item to attach to, so it
      // becomes an item of its own rather than being dropped.
      if (items.length > 0) {
        items[items.length - 1] += nested.html;
      } else {
        items.push(nested.html);
      }
      i = nested.next;
      continue;
    }

    // A different list type at the same depth ends this list.
    if ((block.kind === "bullet" ? "ul" : "ol") !== tag) break;

    items.push(renderRuns(block.runs));
    i++;
  }

  return {
    html: `<${tag}>${items.map((item) => `<li>${item}</li>`).join("")}</${tag}>`,
    next: i,
  };
}

export function blocksToXhtml(blocks: Block[]): string {
  const out: string[] = [];
  let i = 0;

  while (i < blocks.length) {
    const block = blocks[i];

    if (isList(block)) {
      const { html, next } = renderList(blocks, i, block.depth);
      out.push(html);
      i = next;
      continue;
    }

    const text = renderRuns(block.runs);
    // Alignment set away from the book default rides on the block as an inline
    // style, so the reader and the print/EPUB output match the editor. A line
    // placed flush at the margin carries its indent the same way — one style
    // attribute, since a second would overwrite the first in the markup.
    const rules = [
      block.align ? `text-align:${block.align}` : "",
      block.noIndent ? "text-indent:0" : "",
    ].filter(Boolean);
    const align = rules.length ? ` style="${rules.join(";")}"` : "";

    switch (block.kind) {
      case "heading": {
        const level = block.level ?? 1;
        out.push(`<h${level}${align}>${text}</h${level}>`);
        break;
      }
      case "quote":
        out.push(`<blockquote><p>${text}</p></blockquote>`);
        break;
      case "sceneBreak":
        out.push('<p class="scene-break">* * *</p>');
        break;
      case "image": {
        // The figure's alignment sits the image left/right of the column
        // (centre is the default); the width is on the image itself.
        const sided = block.align === "left" || block.align === "right";
        const figAlign = sided ? ` style="text-align:${block.align}"` : "";
        // A wrapped picture becomes a float, and a float has to carry its own
        // width — the paragraph around it shrinks to fit and would otherwise
        // take the whole column with nothing beside it.
        const figWrap =
          block.wrap && sided
            ? ` data-wrap="${block.align}"${
                block.imgWidth
                  ? ` style="text-align:${block.align};width:${escapeXml(block.imgWidth)}"`
                  : ""
              }`
            : "";
        const imgWidth =
          block.imgWidth && !(block.wrap && sided)
            ? ` style="width:${escapeXml(block.imgWidth)}"`
            : "";
        out.push(
          `<p class="figure"${figWrap || figAlign}><img src="${escapeXml(block.src ?? "")}" alt="${escapeXml(block.alt ?? "")}"${imgWidth} /></p>`,
        );
        break;
      }
      case "code":
        out.push(`<pre><code>${text}</code></pre>`);
        break;
      default:
        // An empty paragraph is meaningful vertical space in a book, unlike in
        // Markdown where the blank line between blocks already separates them.
        out.push(`<p${align}>${text}</p>`);
    }
    i++;
  }

  return out.join("");
}
