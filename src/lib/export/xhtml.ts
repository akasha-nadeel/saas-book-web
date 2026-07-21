import type { Block, Run } from "./blocks";

/** Ampersand first, or every subsequent replacement double-escapes. */
export function escapeXml(text: string): string {
  return text
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

    switch (block.kind) {
      case "heading": {
        const level = block.level ?? 1;
        out.push(`<h${level}>${text}</h${level}>`);
        break;
      }
      case "quote":
        out.push(`<blockquote><p>${text}</p></blockquote>`);
        break;
      case "sceneBreak":
        out.push('<p class="scene-break">* * *</p>');
        break;
      case "image":
        out.push(
          `<p class="figure"><img src="${escapeXml(block.src ?? "")}" alt="${escapeXml(block.alt ?? "")}" /></p>`,
        );
        break;
      case "code":
        out.push(`<pre><code>${text}</code></pre>`);
        break;
      default:
        // An empty paragraph is meaningful vertical space in a book, unlike in
        // Markdown where the blank line between blocks already separates them.
        out.push(`<p>${text}</p>`);
    }
    i++;
  }

  return out.join("");
}
