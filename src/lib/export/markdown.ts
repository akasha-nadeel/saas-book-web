import type { Block, Run } from "./blocks";

/**
 * Characters that would otherwise be read as formatting. Escaped in prose but
 * never inside code, where they are just characters.
 */
const ESCAPE = /([\\`*_[\]])/g;

function renderRun(run: Run): string {
  // Two trailing spaces is Markdown's line break.
  if (run.hardBreak) return "  \n";

  if (run.code) {
    // Code is exclusive: no emphasis inside it, and no escaping.
    const code = `\`${run.text}\``;
    return run.href ? `[${code}](${run.href})` : code;
  }

  let out = run.text.replace(ESCAPE, "\\$1");

  if (run.href) out = `[${out}](${run.href})`;
  // Innermost first, so bold wraps italic wraps the text.
  if (run.strike) out = `~~${out}~~`;
  if (run.italic) out = `_${out}_`;
  if (run.bold) out = `**${out}**`;
  // Markdown has no underline; inline HTML is the honest rendering.
  if (run.underline) out = `<u>${out}</u>`;

  return out;
}

const renderRuns = (runs: Run[]) => runs.map(renderRun).join("");

const isList = (block: Block) =>
  block.kind === "bullet" || block.kind === "ordered";

/** An empty paragraph carries no information in Markdown, so it is dropped. */
const isBlank = (block: Block) =>
  block.kind === "paragraph" && block.runs.every((run) => !run.text);

export function blocksToMarkdown(blocks: Block[]): string {
  const kept = blocks.filter((block) => !isBlank(block));
  const rendered: string[] = [];

  // Ordered-list counters, one per depth, reset when a run of list items ends.
  let counters: number[] = [];

  for (const block of kept) {
    if (!isList(block)) counters = [];

    const text = renderRuns(block.runs);
    const indent = "  ".repeat(block.depth);

    switch (block.kind) {
      case "heading":
        rendered.push(`${"#".repeat(block.level ?? 1)} ${text}`);
        break;

      case "quote":
        rendered.push(`> ${text}`);
        break;

      case "sceneBreak":
        rendered.push("* * *");
        break;

      case "code":
        rendered.push(`\`\`\`${block.language ?? ""}\n${text}\n\`\`\``);
        break;

      case "bullet":
        rendered.push(`${indent}- ${text}`);
        break;

      case "ordered":
        counters[block.depth] = (counters[block.depth] ?? 0) + 1;
        counters.length = block.depth + 1;
        rendered.push(`${indent}${counters[block.depth]}. ${text}`);
        break;

      default:
        rendered.push(text);
    }
  }

  // List items of the same kind sit on consecutive lines; everything else is
  // separated by a blank line. Done here rather than inline because the spacing
  // depends on both neighbours.
  let out = "";
  for (let i = 0; i < rendered.length; i++) {
    if (i > 0) {
      const prev = kept[i - 1];
      const here = kept[i];
      const runOfList = isList(prev) && isList(here) && prev.kind === here.kind;
      out += runOfList ? "\n" : "\n\n";
    }
    out += rendered[i];
  }
  return out;
}
