/**
 * The small Markdown a model actually writes, turned into blocks a component
 * can render.
 *
 * **Why this exists.** All three assistant panels printed the reply with
 * `whitespace-pre-wrap`, so a model answering in Markdown — which they all do,
 * unprompted — put `* **Tightening:** Cut fluff` on screen exactly like that,
 * asterisks and all. That is not a styling problem to be tuned; it is a reply
 * nobody has parsed.
 *
 * **Written rather than installed, for the reason `ai.ts` writes Gemini out by
 * hand.** A full CommonMark library is a large dependency, most of it for
 * syntax no model emits into a chat panel — reference links, HTML blocks,
 * setext headings, tables nobody can read in a 300px rail. What is here is the
 * subset that turns up, and it is a few hundred lines with tests instead of a
 * few hundred kilobytes without them.
 *
 * **Generated text is hostile input, and this is the file that has to mean
 * it.** Three rules follow, and none is negotiable:
 *
 * - **The output is data, never HTML.** Blocks and runs of plain strings, which
 *   the renderer turns into React elements. Nothing downstream may reach for
 *   `dangerouslySetInnerHTML`; if it did, a model could be talked into writing
 *   a `<script>` into somebody's editor.
 * - **Raw HTML in the source is text.** `<b>hi</b>` renders as those eight
 *   characters. Passing it through would be the same hole by a politer route.
 * - **A link keeps its words and loses its destination.** `[click](http://…)`
 *   renders as `click`, unlinked. A model-supplied URL is attacker-shaped in
 *   exactly the way this app worries about elsewhere, the assistant has no
 *   reason to send a writer off-site, and a live link in a reply about somebody
 *   else's prose is a phishing surface for no gain.
 *
 * **Marks do not nest, and that is a decision.** A run carries at most one of
 * bold/italic/code, so `**bold with *italic* inside**` comes out bold
 * throughout. Real nesting means a tree, a tree means a recursive renderer, and
 * the case does not occur in a chat reply — where the whole of the formatting
 * is `**Label:**`, a bullet, and the occasional backtick.
 */

/** A piece of text, carrying at most one mark. */
export interface Run {
  text: string;
  mark?: "bold" | "italic" | "code";
}

export type Block =
  | { kind: "para"; runs: Run[] }
  | { kind: "heading"; level: 1 | 2 | 3; runs: Run[] }
  | { kind: "list"; ordered: boolean; items: Run[][] }
  /** `lines` for rendering, `text` for the clipboard. */
  | { kind: "quote"; lines: Run[][]; text: string }
  | { kind: "code"; text: string; lang?: string }
  | { kind: "rule" };

const FENCE = /^\s*(?:```|~~~)\s*([A-Za-z0-9+#-]*)\s*$/;
const HEADING = /^\s{0,3}(#{1,6})\s+(.*)$/;
const RULE = /^\s{0,3}(?:-{3,}|\*{3,}|_{3,})\s*$/;
const QUOTE = /^\s{0,3}>\s?(.*)$/;
const BULLET = /^\s*[-*+]\s+(.*)$/;
const ORDERED = /^\s*\d+[.)]\s+(.*)$/;

/**
 * Parse a reply into blocks.
 *
 * Line-based, because every construct a model emits is decided by the start of
 * a line, and because a streaming reply is parsed again on every chunk — this
 * runs on each frame of a reply arriving, so it stays a single pass with no
 * backtracking.
 */
export function parseMarkdown(source: string): Block[] {
  const lines = source.replace(/\r\n/g, "\n").split("\n");
  const blocks: Block[] = [];

  /* Held between iterations while a multi-line construct is open. */
  let para: string[] = [];
  let quote: string[] = [];
  let list: { ordered: boolean; items: string[] } | null = null;

  const flushPara = () => {
    if (para.length === 0) return;
    blocks.push({ kind: "para", runs: parseInline(para.join(" ")) });
    para = [];
  };
  const flushQuote = () => {
    if (quote.length === 0) return;
    blocks.push({
      kind: "quote",
      lines: quote.map((line) => parseInline(line)),
      text: quote.join("\n"),
    });
    quote = [];
  };
  const flushList = () => {
    if (!list) return;
    blocks.push({
      kind: "list",
      ordered: list.ordered,
      items: list.items.map((item) => parseInline(item)),
    });
    list = null;
  };
  /* Order matters only in that all three must be closed before a new block
     starts; at most one is ever open at a time. */
  const flushAll = () => {
    flushPara();
    flushQuote();
    flushList();
  };

  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i]!;

    /* ---- Fenced code ---------------------------------------------------
       Taken first and consumed whole: everything between the fences is
       literal, so no other rule may look at it. An unclosed fence — which a
       *streaming* reply has on almost every frame, since the closing one has
       not arrived yet — runs to the end of what we have rather than being
       discarded, or the block would flicker into existence only at the end. */
    const fence = FENCE.exec(line);
    if (fence) {
      flushAll();
      const lang = fence[1] || undefined;
      const body: string[] = [];
      i += 1;
      for (; i < lines.length; i += 1) {
        if (FENCE.test(lines[i]!)) break;
        body.push(lines[i]!);
      }
      blocks.push({ kind: "code", text: body.join("\n"), lang });
      continue;
    }

    if (line.trim() === "") {
      flushAll();
      continue;
    }

    const heading = HEADING.exec(line);
    if (heading) {
      flushAll();
      blocks.push({
        kind: "heading",
        /* Capped at 3. A reply in a side panel that asks for an `h5` is not
           making a document outline, and six sizes in a 300px column is noise
           rather than hierarchy. */
        level: Math.min(heading[1]!.length, 3) as 1 | 2 | 3,
        runs: parseInline(heading[2]!),
      });
      continue;
    }

    /* Before the bullet rule: `***` matches both, and a rule is what it is. */
    if (RULE.test(line)) {
      flushAll();
      blocks.push({ kind: "rule" });
      continue;
    }

    const quoted = QUOTE.exec(line);
    if (quoted) {
      flushPara();
      flushList();
      quote.push(quoted[1]!);
      continue;
    }

    const bullet = BULLET.exec(line);
    const ordered = bullet ? null : ORDERED.exec(line);
    if (bullet || ordered) {
      flushPara();
      flushQuote();
      const isOrdered = Boolean(ordered);
      /* A list of the other kind ends the one before it, or a numbered list
         following a bulleted one silently joins it. */
      if (list && list.ordered !== isOrdered) flushList();
      list ??= { ordered: isOrdered, items: [] };
      list.items.push((bullet?.[1] ?? ordered![1]!).trim());
      continue;
    }

    /* A plain line inside an open list is that item continuing onto a second
       line, which is how a model wraps a long bullet. */
    if (list) {
      list.items[list.items.length - 1] += ` ${line.trim()}`;
      continue;
    }

    flushQuote();
    para.push(line.trim());
  }

  flushAll();
  return blocks;
}

/**
 * The inline scanner.
 *
 * Code first, then bold, then italic — the order is the whole correctness
 * argument. `**a**` matched by the italic rule first would produce an empty
 * italic run followed by stray asterisks, and backticks have to win outright
 * because their contents are literal: `` `**not bold**` `` is four asterisks
 * and a phrase.
 */
export function parseInline(source: string): Run[] {
  const runs: Run[] = [];
  let plain = "";

  const keep = (text: string, mark: Run["mark"]) => {
    if (plain) {
      runs.push({ text: plain });
      plain = "";
    }
    if (text) runs.push({ text, mark });
  };

  for (let i = 0; i < source.length; ) {
    const rest = source.slice(i);

    /* Backticks. The closing run must be the same length as the opening one,
       which is what lets a snippet contain a backtick. */
    const code = /^(`+)([\s\S]+?)\1/.exec(rest);
    if (code) {
      keep(code[2]!.trim(), "code");
      i += code[0].length;
      continue;
    }

    /* `(?=\S)` and `(?<=\S)`: a delimiter has to hug its content, or the `a *
       b * c` a model writes for a multiplication becomes an italic run. */
    const bold = /^(\*\*|__)(?=\S)([\s\S]+?)(?<=\S)\1/.exec(rest);
    if (bold && intact(source, i, bold)) {
      keep(bold[2]!, "bold");
      i += bold[0].length;
      continue;
    }

    const italic = /^(\*|_)(?=\S)([\s\S]+?)(?<=\S)\1/.exec(rest);
    if (italic && intact(source, i, italic)) {
      keep(italic[2]!, "italic");
      i += italic[0].length;
      continue;
    }

    /* A link keeps its words and loses its destination — see the file note.
       The label is scanned again so `[**bold** link](url)` keeps its mark. */
    const link = /^\[([^\]]*)\]\(([^)]*)\)/.exec(rest);
    if (link) {
      if (plain) {
        runs.push({ text: plain });
        plain = "";
      }
      runs.push(...parseInline(link[1]!));
      i += link[0].length;
      continue;
    }

    plain += source[i];
    i += 1;
  }

  if (plain) runs.push({ text: plain });
  return runs;
}

/**
 * Whether an underscore match is really emphasis, or a word with underscores
 * in it.
 *
 * **`snake_case_name` is one word, and every Markdown implementation worth
 * copying knows it** — CommonMark calls this intraword emphasis and forbids it
 * for `_` while allowing it for `*`. Without the rule the middle of that
 * identifier is italic, which is not a hypothetical: file names, env vars and
 * column names all turn up in these replies, and this app's own prose is full
 * of `ANTHROPIC_API_KEY` and `last_opened_id`.
 *
 * Asterisks are left alone, deliberately: `**bold**mid` is legal there, and
 * tightening it would break the far commoner `**Label:**text` a model writes
 * when it forgets the space.
 */
function intact(source: string, at: number, match: RegExpExecArray): boolean {
  if (!match[1]!.startsWith("_")) return true;
  const before = at === 0 ? "" : source[at - 1]!;
  const after = source[at + match[0].length] ?? "";
  return !/\w/.test(before) && !/\w/.test(after);
}

/**
 * A block as plain prose, for the clipboard.
 *
 * What a writer wants on the clipboard is the words, not the notation: pasting
 * `**Tightening:**` into a manuscript puts asterisks in a novel. So the marks
 * are dropped rather than preserved — the one place in this app where losing
 * formatting is the correct answer, because the destination is somebody's
 * prose.
 */
export function blockText(block: Block): string {
  switch (block.kind) {
    case "code":
      return block.text;
    case "quote":
      return block.text;
    case "rule":
      return "";
    case "list":
      return block.items.map((item) => runsText(item)).join("\n");
    default:
      return runsText(block.runs);
  }
}

export function runsText(runs: Run[]): string {
  return runs.map((run) => run.text).join("");
}

/**
 * Which blocks are the assistant *offering text* rather than talking.
 *
 * The system prompt tells it to offer prose for the writer to use, and the two
 * places a model puts offered prose are a fenced block and a blockquote. Those
 * get a copy button; a paragraph explaining a suggestion does not, or every
 * reply becomes a column of buttons and the one that matters stops standing
 * out.
 */
export function isOffered(block: Block): boolean {
  return block.kind === "code" || block.kind === "quote";
}
