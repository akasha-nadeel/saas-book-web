import { describe, expect, it } from "vitest";
import {
  blockText,
  isOffered,
  parseInline,
  parseMarkdown,
  runsText,
  type Block,
} from "./markdown";

/** The blocks, flattened to something an assertion can read at a glance. */
const shape = (source: string) =>
  parseMarkdown(source).map((b) =>
    b.kind === "list"
      ? `list${b.ordered ? "#" : "*"}:${b.items.map(runsText).join("|")}`
      : b.kind === "rule"
        ? "rule"
        : b.kind === "code"
          ? `code:${b.text}`
          : b.kind === "quote"
            ? `quote:${b.text}`
            : b.kind === "heading"
              ? `h${b.level}:${runsText(b.runs)}`
              : `para:${runsText(b.runs)}`,
  );

describe("parseMarkdown", () => {
  /*
   * The reply from the screenshot that started this. It rendered as literal
   * asterisks in all three assistant panels, which is what the whole module
   * exists to stop.
   */
  it("reads the shape a model actually replies in", () => {
    expect(
      shape(
        [
          "Here is how I can help with your chapter:",
          "",
          "* **Drafting & Continuations:** Write the next line.",
          "* **Tightening:** Cut fluff, streamline pacing.",
          "",
          "Whenever you're ready, paste in some text.",
        ].join("\n"),
      ),
    ).toEqual([
      "para:Here is how I can help with your chapter:",
      "list*:Drafting & Continuations: Write the next line.|Tightening: Cut fluff, streamline pacing.",
      "para:Whenever you're ready, paste in some text.",
    ]);
  });

  it("keeps the bold lead-in as its own run", () => {
    const [list] = parseMarkdown("* **Tightening:** Cut fluff.");
    expect(list).toMatchObject({ kind: "list", ordered: false });
    expect((list as Extract<Block, { kind: "list" }>).items[0]).toEqual([
      { text: "Tightening:", mark: "bold" },
      { text: " Cut fluff." },
    ]);
  });

  it("tells the two kinds of list apart, and does not merge them", () => {
    expect(shape("- one\n- two\n\n1. first\n2. second")).toEqual([
      "list*:one|two",
      "list#:first|second",
    ]);
  });

  /* A numbered list straight after a bulleted one, with no blank line. */
  it("ends a list when the other kind starts", () => {
    expect(shape("- one\n1. first")).toEqual(["list*:one", "list#:first"]);
  });

  it("joins a bullet that wrapped onto a second line", () => {
    expect(shape("- a long bullet\n  that wrapped")).toEqual([
      "list*:a long bullet that wrapped",
    ]);
  });

  it("caps headings at three levels", () => {
    expect(shape("# one\n\n## two\n\n##### five")).toEqual([
      "h1:one",
      "h2:two",
      "h3:five",
    ]);
  });

  it("takes a fenced block whole, and leaves its contents alone", () => {
    expect(shape("```\n* not a bullet\n**not bold**\n```")).toEqual([
      "code:* not a bullet\n**not bold**",
    ]);
  });

  /*
   * **The streaming case, and the reason the fence is not required to close.**
   * A reply is re-parsed on every chunk, so for most frames the closing fence
   * has not arrived. Discarding an unterminated block would make offered prose
   * appear only once the model had finished, which is the one place a reader is
   * watching most closely.
   */
  it("shows an unclosed fence rather than waiting for the end", () => {
    expect(shape("```\nhalf a line")).toEqual(["code:half a line"]);
  });

  it("keeps the language tag", () => {
    const [code] = parseMarkdown("```ts\nconst a = 1;\n```");
    expect(code).toEqual({ kind: "code", text: "const a = 1;", lang: "ts" });
  });

  it("gathers a quote and keeps its raw text for the clipboard", () => {
    const [quote] = parseMarkdown("> The rain had not stopped.\n> Mira waited.");
    expect(quote).toMatchObject({
      kind: "quote",
      text: "The rain had not stopped.\nMira waited.",
    });
  });

  /* `***` is both a rule and a bullet; it is a rule. */
  it("reads a divider as a divider", () => {
    expect(shape("a\n\n---\n\nb")).toEqual(["para:a", "rule", "para:b"]);
  });

  it("runs a wrapped paragraph back into one", () => {
    expect(shape("one line\nand its continuation")).toEqual([
      "para:one line and its continuation",
    ]);
  });

  it("has nothing to say about nothing", () => {
    expect(parseMarkdown("")).toEqual([]);
    expect(parseMarkdown("\n\n   \n")).toEqual([]);
  });
});

describe("parseInline", () => {
  it("marks bold, italic and code", () => {
    expect(parseInline("a **b** c *d* e `f`")).toEqual([
      { text: "a " },
      { text: "b", mark: "bold" },
      { text: " c " },
      { text: "d", mark: "italic" },
      { text: " e " },
      { text: "f", mark: "code" },
    ]);
  });

  /* Order: bold is tried before italic, or `**a**` becomes an empty italic
     run and two stray asterisks. */
  it("does not read bold as two italics", () => {
    expect(parseInline("**a**")).toEqual([{ text: "a", mark: "bold" }]);
  });

  /* Backticks win outright — their contents are literal. */
  it("leaves markup inside code alone", () => {
    expect(parseInline("`**not bold**`")).toEqual([
      { text: "**not bold**", mark: "code" },
    ]);
  });

  /*
   * The delimiter has to hug its content, or ordinary prose sprouts italics:
   * `snake_case_name` is one word and `2 * 3 * 4` is arithmetic.
   */
  it("leaves a loose asterisk or underscore as text", () => {
    expect(runsText(parseInline("2 * 3 * 4"))).toBe("2 * 3 * 4");
    expect(parseInline("2 * 3 * 4").every((r) => !r.mark)).toBe(true);
    expect(parseInline("snake_case_name").every((r) => !r.mark)).toBe(true);
  });

  /*
   * **A link keeps its words and loses its destination**, which is a security
   * decision rather than a formatting one — see the note in `markdown.ts`. A
   * model-supplied URL is attacker-shaped, and the assistant has no reason to
   * send a writer off-site.
   */
  it("strips a link to its label", () => {
    expect(parseInline("see [the docs](https://evil.example) now")).toEqual([
      { text: "see " },
      { text: "the docs" },
      { text: " now" },
    ]);
  });

  it("keeps a mark inside a link label", () => {
    expect(parseInline("[**bold** link](http://x)")).toEqual([
      { text: "bold", mark: "bold" },
      { text: " link" },
    ]);
  });

  /*
   * Raw HTML is text. The output of this module is data that a component turns
   * into React elements, so nothing can be injected — but it must also not be
   * *shown* as though it were markup the app understood.
   */
  it("treats raw HTML as characters", () => {
    expect(parseInline("<script>alert(1)</script>")).toEqual([
      { text: "<script>alert(1)</script>" },
    ]);
  });
});

describe("blockText", () => {
  /*
   * **Marks are dropped on the way to the clipboard, and that is the point.**
   * The destination is somebody's novel; pasting `**Tightening:**` into a
   * manuscript puts asterisks in a book.
   */
  it("gives the words without the notation", () => {
    const [para] = parseMarkdown("**Tightening:** cut the fluff.");
    expect(blockText(para!)).toBe("Tightening: cut the fluff.");
  });

  it("gives a quote back exactly as it was written", () => {
    const [quote] = parseMarkdown("> line one\n> line two");
    expect(blockText(quote!)).toBe("line one\nline two");
  });

  it("gives a list one item per line", () => {
    const [list] = parseMarkdown("- one\n- two");
    expect(blockText(list!)).toBe("one\ntwo");
  });
});

describe("isOffered", () => {
  /*
   * Only the two blocks a model puts *offered prose* in get a copy button. A
   * paragraph explaining a suggestion does not, or every reply becomes a column
   * of buttons and the one that matters stops standing out.
   */
  it("is true for the blocks that hold offered prose", () => {
    expect(parseMarkdown("> a quote").map(isOffered)).toEqual([true]);
    expect(parseMarkdown("```\ncode\n```").map(isOffered)).toEqual([true]);
  });

  it("is false for the assistant talking", () => {
    expect(parseMarkdown("a paragraph").map(isOffered)).toEqual([false]);
    expect(parseMarkdown("- a bullet").map(isOffered)).toEqual([false]);
    expect(parseMarkdown("# a heading").map(isOffered)).toEqual([false]);
  });
});

describe("underscores in ordinary words", () => {
  /*
   * Caught by a test rather than in review, which is why it is worth keeping:
   * `snake_case_name` had its middle set in italic. CommonMark forbids
   * intraword emphasis for `_` for exactly this reason, and this app's replies
   * are full of `ANTHROPIC_API_KEY` and `last_opened_id`.
   */
  it("leaves an identifier alone", () => {
    for (const word of [
      "snake_case_name",
      "ANTHROPIC_API_KEY",
      "last_opened_id",
      "a_b_c_d",
    ]) {
      expect(parseInline(word), word).toEqual([{ text: word }]);
    }
  });

  /* But a real one still works, because the delimiters stand clear. */
  it("still reads emphasis when the underscores stand clear", () => {
    expect(parseInline("say _this_ now")).toEqual([
      { text: "say " },
      { text: "this", mark: "italic" },
      { text: " now" },
    ]);
    expect(parseInline("__loud__")).toEqual([{ text: "loud", mark: "bold" }]);
  });

  /* Asterisks are deliberately not tightened the same way: a model writing
     `**Label:**text` without the space is far commoner than intraword `*`. */
  it("still allows asterisk emphasis mid-word", () => {
    expect(parseInline("**Label:**text")).toEqual([
      { text: "Label:", mark: "bold" },
      { text: "text" },
    ]);
  });
});
