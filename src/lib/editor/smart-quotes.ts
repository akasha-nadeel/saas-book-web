import { Extension, InputRule, escapeForRegEx, textInputRule } from "@tiptap/core";

/**
 * The four substitutions that separate a manuscript from a book.
 *
 * **A published novel does not use straight quotes.** `"` and `'` are typewriter
 * marks — the compromise a 19th-century keyboard made to fit two glyphs on one
 * key — and every printed book, every shop's preview and every e-reader shows
 * `“ ” ‘ ’` instead. Typing them straight is the single most visible sign that a
 * file was never set, on a product whose whole pitch is handing a shop something
 * it will take. The em dash and the ellipsis are the same argument: `--` and
 * `...` are what a typewriter could manage, not what a book prints.
 *
 * **Written here rather than taken from `@tiptap/extension-typography`**, which
 * also rewrites `(c)` to `©`, `1/2` to `½`, `->` to `→` and `!=` to `≠`.
 * Novelists do not type those on purpose, and a writer who does — in a
 * character's chat log, in a recipe, in a fraction — would find their prose
 * quietly altered. Four rules is not worth a dependency to keep patched: the
 * same reasoning `ai.ts` gives for writing Gemini out by hand and `email/send.ts`
 * for reaching Resend over REST.
 *
 * **Nothing already written is touched.** These are input rules: they fire on
 * the keystroke that completes the pattern and nowhere else, so an imported
 * manuscript keeps exactly the characters it arrived with. Undo reverses a
 * substitution on its own, as it does in Word — press it once and the straight
 * character is back, which is the escape hatch for the rare line that wants one.
 */

/**
 * Whether an apostrophe or quote here opens or closes.
 *
 * **The character before it is the whole rule.** Nothing, a space, or an
 * opening bracket means a quotation is starting; a letter, a digit or closing
 * punctuation means it is ending — which is also what makes `don't` an
 * apostrophe rather than an opening quote, since `n` is a letter.
 *
 * Exported for the tests: this is the one piece of judgement in the file and
 * the one worth being able to argue with directly.
 */
export function opensHere(before: string): boolean {
  return before === "" || /[\s([{—–]/.test(before);
}

/**
 * A quote rule, built from the pair it produces.
 *
 * `InputRule` rather than `textInputRule`, which takes a fixed string: which
 * of the two characters this is depends on what precedes it, so the
 * replacement has to be decided when the rule fires. The document is read for
 * the character before the match, because an input rule is handed only the
 * text it matched and the one thing this needs is the character it did not.
 */
function quoteRule(straight: string, open: string, close: string) {
  return new InputRule({
    find: new RegExp(escapeForRegEx(straight) + '$'),
    handler: ({ state, range, chain }) => {
      const before =
        range.from > 1 ? state.doc.textBetween(range.from - 1, range.from) : '';
      chain()
        .insertContentAt(range, opensHere(before) ? open : close)
        .run();
    },
  });
}

export const SmartQuotes = Extension.create({
  name: "smartQuotes",

  addInputRules() {
    return [
      quoteRule('"', "“", "”"),
      quoteRule("'", "‘", "’"),

      /* Two hyphens between characters, which is how a typewriter wrote an em
         dash. Deliberately not three — `---` is nobody's habit — and not a
         single hyphen, which is a hyphen. */
      textInputRule({ find: /--$/, replace: "—" }),

      /* Three dots to one character. A real ellipsis sets with its own spacing
         and cannot be broken across a line, which is why typesetters use it. */
      textInputRule({ find: /\.\.\.$/, replace: "…" }),
    ];
  },
});
