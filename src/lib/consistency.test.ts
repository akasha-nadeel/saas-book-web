import { describe, expect, it } from "vitest";

import {
  ALL_CHECKS,
  ambiguousPair,
  consistencyReport,
  REAL_BREAK,
  driftKey,
  looksLikeDrift,
  withinOneEdit,
  type BookText,
  type CheckId,
} from "./consistency";
import { NAME_WORDS } from "./name-words";
import { SPELLING_PAIRS } from "./spelling-pairs";
import { STYLE_PAIRS } from "./style-pairs";

const chapter = (title: string, text: string, number: number | null = 1): BookText => ({
  chapterId: title.toLocaleLowerCase().replace(/\s+/g, "-"),
  title,
  number,
  text,
});

const only = (book: BookText[], check: CheckId) =>
  consistencyReport(book).findings.filter((f) => f.check === check);

/**
 * A name used `times` times, always in the middle of its sentence.
 *
 * Mid-sentence is not decoration in these fixtures — it is the condition the
 * name check runs on, because every sentence begins with a capital.
 */
const uses = (name: string, times: number) =>
  Array.from(
    { length: times },
    (_, i) => `The room was quiet and ${name} waited by the door, once more at ${i}.`,
  ).join(" ");

describe("what the writer is shown", () => {
  it("hears a name spelled two ways thirty chapters apart", () => {
    const found = only(
      [
        chapter("One", uses("Katherine", 12)),
        chapter("Thirty", uses("Catherine", 2), 30),
      ],
      "names",
    );

    expect(found).toHaveLength(1);
    expect(found[0].variants.map((v) => v.text)).toEqual([
      "Katherine",
      "Catherine",
    ]);
  });

  it("says which chapters each spelling is in, in reading order", () => {
    const [finding] = only(
      [
        chapter("One", uses("Katherine", 12)),
        chapter("Thirty", uses("Catherine", 2), 30),
      ],
      "names",
    );

    /* `toMatchObject` rather than `toEqual`: what this test is about is which
       chapters, and in what order. It pinned the whole row, so it also pinned
       the *absence* of every field `Where` had not grown yet — and went red on
       `example` arriving, which is not a thing it has an opinion about. The
       length check is what keeps it a statement about the chapters. */
    expect(finding.variants[0].where).toHaveLength(1);
    expect(finding.variants[0].where[0]).toMatchObject({
      chapterId: "one",
      chapterTitle: "One",
      number: 1,
      count: 12,
    });
    expect(finding.variants[1].where[0].chapterTitle).toBe("Thirty");
    expect(finding.variants[1].where[0].number).toBe(30);
  });

  it("puts the spelling the book mostly uses first", () => {
    const [finding] = only(
      [chapter("One", `${uses("Catherine", 2)} ${uses("Katherine", 12)}`)],
      "names",
    );
    expect(finding.variants[0].text).toBe("Katherine");
  });

  it("pulls a sentence out for each spelling, so it can be seen in place", () => {
    const [finding] = only(
      [
        chapter("One", uses("Katherine", 12)),
        chapter("Thirty", uses("Catherine", 2), 30),
      ],
      "names",
    );
    for (const variant of finding.variants) {
      expect(variant.example).toContain(variant.text);
    }
  });

  /** Splitting a character's tally in two over an apostrophe would hide them. */
  it("counts a possessive as the name it belongs to", () => {
    const report = consistencyReport([
      chapter("One", "She took Katherine's coat and Katherine's hat as well."),
    ]);
    expect(report.words).toBeGreaterThan(0);
    expect(report.findings).toHaveLength(0);
  });
});

describe("names — what it refuses to call drift", () => {
  /**
   * Two people, and the count is what says so. A form used a quarter as often
   * as its neighbour is drift; one used two-thirds as often is a character.
   */
  it("leaves two names used all through the book alone", () => {
    const found = only(
      [chapter("One", `${uses("Marcus", 30)} ${uses("Markus", 22)}`)],
      "names",
    );
    expect(found).toHaveLength(0);
  });

  it("leaves Tom and Tim alone, where one edit is a third of the word", () => {
    expect(looksLikeDrift("Tom", "Tim")).toBe(false);
    expect(looksLikeDrift("Ann", "Ana")).toBe(false);
  });

  /**
   * `marry` is a lower-case verb. It only ever enters the candidate table
   * capitalised at the head of a sentence, so the mid-sentence share disposes
   * of it upstream — no rule about doubled consonants is needed.
   */
  it("leaves Mary and Marry alone, because Marry only opens sentences", () => {
    const found = only(
      [
        chapter(
          "One",
          `${uses("Mary", 12)} Marry him, she said. Marry him now, she said again.`,
        ),
      ],
      "names",
    );
    expect(found).toHaveLength(0);
  });

  /** Substituting a vowel is how English tells given names apart. */
  it("leaves a short pair one vowel apart alone", () => {
    expect(looksLikeDrift("Ellen", "Ellon")).toBe(false);
    expect(looksLikeDrift("Jan", "Jon")).toBe(false);
  });

  /** ...but not at length, where a vowel slip is a slip. */
  it("still hears Katherine against Katharine", () => {
    expect(looksLikeDrift("Katherine", "Katharine")).toBe(true);
  });

  it("leaves a first-letter swap alone unless English actually makes it", () => {
    expect(looksLikeDrift("Ben", "Ken")).toBe(false);
    expect(looksLikeDrift("Bella", "Della")).toBe(false);
    expect(looksLikeDrift("Katherine", "Catherine")).toBe(true);
    expect(looksLikeDrift("Sofia", "Zofia")).toBe(true);
  });

  it("leaves Fenner and Fenners alone, because a plural is not a spelling", () => {
    expect(looksLikeDrift("Fenner", "Fenners")).toBe(false);
  });

  it("leaves a case difference alone, because that is where a sentence starts", () => {
    expect(looksLikeDrift("Ash", "ash")).toBe(false);
  });

  /** Two fingers, one slip — and almost never a different name. */
  it("hears a swapped pair of letters", () => {
    expect(looksLikeDrift("Sofia", "Sofai")).toBe(true);
    expect(withinOneEdit("Sofia", "Sofai")).toBe(true);
  });

  it("says nothing when the commoner spelling is barely used", () => {
    const found = only(
      [chapter("One", `${uses("Katherine", 4)} ${uses("Catherine", 1)}`)],
      "names",
    );
    expect(found).toHaveLength(0);
  });

  it("leaves two names introduced in the same sentence alone", () => {
    const found = only(
      [
        chapter(
          "One",
          `${uses("Katherine", 12)} And so Katherine met Catherine at the gate, and Catherine smiled.`,
        ),
      ],
      "names",
    );
    expect(found).toHaveLength(0);
  });

  /**
   * A gap edit at the end puts one spelling inside the other. Tested because
   * a substring version of the same-sentence guard silently dropped every one
   * of these, which is a whole class of drift going missing with nothing to
   * show for it.
   */
  it("hears a pair where one spelling contains the other", () => {
    const found = only(
      [
        chapter("One", uses("Kathryn", 12)),
        chapter("Thirty", uses("Kathryne", 2), 30),
      ],
      "names",
    );
    expect(found).toHaveLength(1);
    expect(found[0].variants.map((v) => v.text)).toEqual([
      "Kathryn",
      "Kathryne",
    ]);
  });

  it("folds three spellings of one name into one finding, not two", () => {
    const found = only(
      [
        chapter("One", uses("Katherine", 20)),
        chapter("Two", `${uses("Catherine", 2)} ${uses("Katharine", 2)}`, 2),
      ],
      "names",
    );
    expect(found).toHaveLength(1);
    expect(found[0].variants).toHaveLength(3);
  });
});

describe("names — when there is a story bible", () => {
  const book = [
    chapter("One", uses("Marcus", 30)),
    chapter("Two", uses("Marius", 2), 2),
  ];

  it("takes the writer's word that two entries are two people", () => {
    const report = consistencyReport(book, {
      known: [["Marcus"], ["Marius"]],
    });
    expect(report.findings.filter((f) => f.check === "names")).toHaveLength(0);
  });

  it("takes the writer's word that a nickname is deliberate", () => {
    const report = consistencyReport(book, {
      known: [["Marcus", "Marius"]],
    });
    expect(report.findings.filter((f) => f.check === "names")).toHaveLength(0);
  });

  it("works exactly the same on the empty bible most books have", () => {
    expect(consistencyReport(book, { known: [] }).findings).toEqual(
      consistencyReport(book).findings,
    );
  });

  it("says whether it had a bible to work from", () => {
    expect(consistencyReport(book).usedBible).toBe(false);
    expect(consistencyReport(book, { known: [["Marcus"]] }).usedBible).toBe(true);
  });
});

describe("British and American spellings", () => {
  it("finds colour and color in the same book", () => {
    const found = only(
      [
        chapter("One", "The colour of the sky was low."),
        chapter("Two", "The color of the sea was high.", 2),
      ],
      "spelling",
    );
    expect(found).toHaveLength(1);
    expect(found[0].variants.map((v) => v.text).sort()).toEqual([
      "color",
      "colour",
    ]);
  });

  it("says nothing when only one of the pair is used", () => {
    expect(
      only([chapter("One", "The colour of the sky was low.")], "spelling"),
    ).toHaveLength(0);
  });

  /** The guard that lets the table be generous: a spelling not in the book. */
  it("invents no spelling that is not in the book", () => {
    const report = consistencyReport([
      chapter("One", "He counted four of them, and then waited for an hour."),
    ]);
    expect(report.findings).toHaveLength(0);
  });

  /** Every novel contains "story" and "check". */
  it("leaves story and check and draft alone, because they are ordinary words", () => {
    const found = only(
      [
        chapter("One", "He told the story on the second storey of the house."),
        chapter("Two", "She wrote a cheque and did not check the draught.", 2),
      ],
      "spelling",
    );
    expect(found).toHaveLength(0);
  });

  it("finds travelled beside traveled, and grey beside gray", () => {
    const found = only(
      [
        chapter("One", "They travelled far. The grey wall stood."),
        chapter("Two", "They traveled far. The gray wall fell.", 2),
      ],
      "spelling",
    );
    expect(found).toHaveLength(2);
  });
});

describe("quotation marks", () => {
  it("finds straight quotes in the imported chapters and curly in the rest", () => {
    const found = only(
      [
        chapter("One", 'She said, "I will go there now."'),
        chapter("Two", "She said, “I will stay here.”", 2),
      ],
      "quotes",
    );
    expect(found).toHaveLength(1);
    expect(found[0].variants.map((v) => v.where[0].chapterTitle)).toEqual([
      "One",
      "Two",
    ]);
  });

  it("counts apostrophes as their own question", () => {
    const found = only(
      [
        chapter("One", "It was John's coat, and it did not fit."),
        chapter("Two", "It was Mary’s coat, and it did fit.", 2),
      ],
      "quotes",
    );
    expect(found).toHaveLength(1);
    expect(found[0].note).toContain("apostrophe");
  });

  it("says nothing about a book that is curly all the way through", () => {
    expect(
      only(
        [chapter("One", "She said, “I will go.” It was Mary’s idea.")],
        "quotes",
      ),
    ).toHaveLength(0);
  });
});

describe("doubled words", () => {
  it("finds the same word twice in a row", () => {
    const found = only([chapter("One", "He opened the the door.")], "doubled");
    expect(found).toHaveLength(1);
    expect(found[0].variants[0].text).toBe("the the");
    expect(found[0].passages?.[0].text).toBe("He opened the the door.");
  });

  it("leaves she had had enough alone", () => {
    expect(
      only([chapter("One", "She had had enough of the noise.")], "doubled"),
    ).toHaveLength(0);
  });

  /** People talk that way, and the comma is the proof. */
  it("leaves a word repeated across a comma alone", () => {
    expect(
      only([chapter("One", "He was tired, tired of waiting for her.")], "doubled"),
    ).toHaveLength(0);
  });

  it("leaves New New York alone", () => {
    expect(
      only([chapter("One", "The train to New New York was late again.")], "doubled"),
    ).toHaveLength(0);
  });

  it("does not join the end of one paragraph to the start of the next", () => {
    expect(
      only([chapter("One", "He opened the\n\nThe door was shut.")], "doubled"),
    ).toHaveLength(0);
  });
});

describe("a quotation mark left open", () => {
  it("finds a paragraph of speech with one mark in it", () => {
    const found = only(
      [chapter("One", 'She turned and said, "I am going home.\n\nHe watched her go.')],
      "unclosed",
    );
    expect(found).toHaveLength(1);
    expect(found[0].passages).toHaveLength(1);
  });

  /** Correct typesetting, and the reason the naive check is unusable. */
  it("leaves a speech that runs over three paragraphs alone", () => {
    const found = only(
      [
        chapter(
          "One",
          '"I went to the house,\n\n"and I waited there a while,\n\n"and then I left."',
        ),
      ],
      "unclosed",
    );
    expect(found).toHaveLength(0);
  });

  it("says nothing about a book that sets dialogue in single quotes", () => {
    expect(
      only(
        [chapter("One", "She said, 'I am going home.'\n\nHe watched her go.")],
        "unclosed",
      ),
    ).toHaveLength(0);
  });

  it("gives up entirely rather than be wrong a dozen times", () => {
    const noisy = Array.from(
      { length: 20 },
      (_, i) => `The sign said " and the number was ${i}.`,
    ).join("\n\n");
    expect(only([chapter("One", noisy)], "unclosed")).toHaveLength(0);
  });
});

describe("hyphenation", () => {
  it("finds a compound written hyphenated in one chapter and closed in another", () => {
    const found = only(
      [
        chapter("One", "The moon-lit garden was cold and still."),
        chapter("Two", "The moonlit garden was warm and bright.", 2),
      ],
      "hyphens",
    );
    expect(found).toHaveLength(1);
  });

  /** English requires both, and telling them apart needs a parser. */
  it("leaves a well-known writer who is well known alone", () => {
    expect(
      only(
        [
          chapter("One", "She was a well-known writer in the city."),
          chapter("Two", "In the city she was well known by then.", 2),
        ],
        "hyphens",
      ),
    ).toHaveLength(0);
  });

  it("leaves a two-letter prefix alone, because e-mail is not a compound", () => {
    expect(
      only(
        [
          chapter("One", "He sent an e-mail to the office that day."),
          chapter("Two", "He sent an email to the office that day.", 2),
        ],
        "hyphens",
      ),
    ).toHaveLength(0);
  });

  it("never invents a compound out of two words that were never hyphenated", () => {
    expect(
      only([chapter("One", "The garden gate was open all the summer long.")], "hyphens"),
    ).toHaveLength(0);
  });
});

describe("reading the book", () => {
  it("reports the chapters and the words it actually read", () => {
    const report = consistencyReport([
      chapter("One", "The room was quiet."),
      chapter("Two", "The door was shut.", 2),
    ]);
    expect(report.chapters).toBe(2);
    expect(report.words).toBe(8);
  });

  /**
   * The state the screen keys off. A check that did not run must never be
   * shown as one that found nothing.
   */
  it("has nothing to say about a book with no prose in it", () => {
    const report = consistencyReport([]);
    expect(report.chapters).toBe(0);
    expect(report.findings).toHaveLength(0);
  });
});

describe("dismissals", () => {
  const book = [
    chapter("One", uses("Katherine", 12)),
    chapter("Thirty", uses("Catherine", 2), 30),
  ];

  it("never shows a finding the writer has already said no to", () => {
    const [finding] = consistencyReport(book).findings;
    const after = consistencyReport(book, { dismissed: [finding.key] });
    expect(after.findings.some((f) => f.key === finding.key)).toBe(false);
  });

  /** A key made of counts would come undone on the next keystroke. */
  it("keys a finding on its spellings, not on its counts", () => {
    const [first] = consistencyReport(book).findings;
    const longer = [
      chapter("One", uses("Katherine", 40)),
      chapter("Thirty", uses("Catherine", 3), 30),
    ];
    const [second] = consistencyReport(longer).findings;
    expect(second.key).toBe(first.key);
  });

  it("orders a key the same however the spellings arrive", () => {
    expect(driftKey("names", ["Catherine", "Katherine"])).toBe(
      driftKey("names", ["Katherine", "Catherine"]),
    );
  });
});

describe("what it refuses to do", () => {
  const book = [
    chapter("One", `${uses("Katherine", 12)} He opened the the door.`),
    chapter("Thirty", uses("Catherine", 2), 30),
  ];

  /**
   * The rule the whole module exists under. A number out of a hundred for a
   * manuscript would be invented to look like an answer.
   */
  it("produces no score, grade or rating of any kind", () => {
    const report = consistencyReport(book);
    expect(Object.keys(report)).not.toContain("score");
    expect(Object.keys(report)).not.toContain("grade");
    expect(Object.keys(report)).not.toContain("rating");
  });

  it("gives every finding something to show and a reason", () => {
    const report = consistencyReport(book);
    expect(report.findings.length).toBeGreaterThan(0);
    for (const finding of report.findings) {
      expect(finding.note.length).toBeGreaterThan(20);
      expect(
        finding.variants.length >= 2 || (finding.passages?.length ?? 0) >= 1,
      ).toBe(true);
    }
  });

  /**
   * The house rule pointed at words: report facts, never verdicts. The tool
   * guide's plan-words test is the same shape.
   */
  it("says why anybody mentions each thing, never what to do about it", () => {
    for (const finding of consistencyReport(book).findings) {
      expect(finding.note).not.toMatch(
        /\b(should|must|fix|correct|replace|instead|pick one)\b/i,
      );
    }
  });

  it("reports nothing at all rather than a finding with one spelling in it", () => {
    for (const finding of consistencyReport(book).findings) {
      if (finding.check === "names" || finding.check === "spelling") {
        expect(finding.variants.length).toBeGreaterThanOrEqual(2);
      }
    }
  });
});

describe("running only some of the checks", () => {
  const book = [
    chapter("One", `${uses("Katherine", 12)} She liked the colour grey. "Quiet," she said.`),
    chapter("Thirty", `${uses("Catherine", 2)} She liked the color grey. \u201cQuiet,\u201d she said.`, 30),
  ];

  it("runs every check it can when it is not told otherwise", () => {
    /*
     * **Every check but the one that needs something fetched.** The near-miss
     * check reads a word list the browser downloads on demand; with none
     * supplied it is left out of `ran` rather than counted as a check that
     * found nothing. That distinction is the whole reason `ran` exists.
     */
    expect(consistencyReport(book).ran).toEqual(
      ALL_CHECKS.filter((id) => id !== "typos"),
    );
  });

  it("runs all of them once the word list is there", () => {
    expect(consistencyReport(book, { words: new Set(["colour"]) }).ran).toEqual(
      ALL_CHECKS,
    );
  });

  it("reports only the check it was asked for", () => {
    const report = consistencyReport(book, { only: ["names"] });
    expect(report.ran).toEqual(["names"]);
    expect(report.findings.every((f) => f.check === "names")).toBe(true);
    expect(report.findings.length).toBeGreaterThan(0);
  });

  it("still finds the same thing whether it ran alone or with the others", () => {
    // A check must not depend on another having run first — the one way a
    // subset could quietly answer differently from the whole.
    const alone = consistencyReport(book, { only: ["spelling"] }).findings;
    const together = consistencyReport(book).findings.filter(
      (f) => f.check === "spelling",
    );
    expect(alone.map((f) => f.key)).toEqual(together.map((f) => f.key));
  });

  it("keeps counting the book even when one check runs", () => {
    // `chapters` and `words` are about the reading, not about the checks.
    const one = consistencyReport(book, { only: ["quotes"] });
    expect(one.chapters).toBe(consistencyReport(book).chapters);
    expect(one.words).toBe(consistencyReport(book).words);
  });

  /**
   * **The state the whole `ran` field exists for.** Nothing found because
   * nothing was asked for is not the same answer as nothing found by six
   * checks, and a screen with only `findings` to read cannot tell them apart.
   */
  it("says it ran nothing when it was asked for nothing", () => {
    const report = consistencyReport(book, { only: [] });
    expect(report.ran).toEqual([]);
    expect(report.findings).toHaveLength(0);
    expect(report.chapters).toBe(2);
  });

  it("ignores a check id it does not know rather than inventing one", () => {
    const report = consistencyReport(book, {
      only: ["names", "nonsense" as CheckId],
    });
    expect(report.ran).toEqual(["names"]);
  });

  it("says what it ran even on a book with no prose in it", () => {
    expect(consistencyReport([], { only: ["names"] }).ran).toEqual(["names"]);
  });
});

describe("a sentence from each chapter", () => {
  it("shows the line the spelling is on, chapter by chapter", () => {
    const [finding] = only(
      [
        chapter("One", "The hall was cold and Katherine waited there alone."),
        chapter("Two", `${uses("Katherine", 11)}`, 2),
        chapter("Thirty", "A lamp was lit before Catherine reached the stair.", 30),
      ],
      "names",
    );
    const rare = finding.variants.find((v) => v.text === "Catherine");
    expect(rare?.where[0].example).toContain("Catherine");
  });

  /**
   * The whole reason this hangs off the chapter rather than off the spelling:
   * one example for the book cannot show what chapter thirty says.
   */
  it("takes each chapter's line from that chapter and not from another", () => {
    const [finding] = only(
      [
        chapter("One", "The hall was cold and Katherine waited there alone."),
        chapter("Two", "A lamp was lit before Katherine reached the stair.", 2),
        chapter("Three", `${uses("Katherine", 10)}`, 3),
        chapter("Thirty", "The gate stood open where Catherine had left it.", 30),
      ],
      "names",
    );
    const common = finding.variants.find((v) => v.text === "Katherine");
    expect(common?.where[0].example).toContain("hall was cold");
    expect(common?.where[1].example).toContain("lamp was lit");
  });

  it("gives the quotation-mark check something to show, not just a count", () => {
    // This check counted marks and printed nothing of the book for its whole
    // life, which is the wrong way round for the one check that is about how a
    // character prints.
    const [finding] = only(
      [
        chapter("One", 'He said, "wait here," and she waited.'),
        chapter("Two", "She said, \u201cno,\u201d and left.", 2),
      ],
      "quotes",
    );
    const straight = finding.variants.find((v) => v.text === '"');
    expect(straight?.where[0].example).toContain("wait here");
  });
});

describe("the spelling table", () => {
  const both = (b: string, a: string) => [
    chapter("One", `The room was quiet and she liked the ${b} of it.`),
    chapter("Two", `The door was shut and he liked the ${a} of it.`, 2),
  ];
  const finds = (b: string, a: string) =>
    only(both(b, a), "spelling").length > 0;

  it("is big enough to be worth having", () => {
    // 112 hand-typed pairs was the whole check for its first life. The number
    // is pinned so a build that silently produced a stub is a red test rather
    // than a check that quietly stops finding things.
    expect(SPELLING_PAIRS.length).toBeGreaterThan(2000);
  });

  it("finds the pairs the hand-written list was blind to", () => {
    for (const [b, a] of [
      ["sulphur", "sulfur"],
      ["aeroplane", "airplane"],
      ["artefact", "artifact"],
      ["ageing", "aging"],
      ["neighbourhood", "neighborhood"],
      ["catalogue", "catalog"],
      ["cosy", "cozy"],
    ] as const) {
      expect(finds(b, a), `${b}/${a}`).toBe(true);
    }
  });

  it("still finds everything it always found", () => {
    for (const [b, a] of [
      ["colour", "color"],
      ["grey", "gray"],
      ["realise", "realize"],
      ["travelled", "traveled"],
      ["defence", "defense"],
    ] as const) {
      expect(finds(b, a), `${b}/${a}`).toBe(true);
    }
  });

  /**
   * **The half that matters.** A bigger table is only worth having if it did
   * not bring the traps with it — a pair where one side is an ordinary word
   * with another meaning fires on nearly every novel, and one of those costs
   * more than the findings it arrived with.
   */
  it("says nothing about words that only look like a pair", () => {
    for (const [b, a] of [
      ["storey", "story"],
      ["cheque", "check"],
      ["draught", "draft"],
      ["tyre", "tire"],
      ["kerb", "curb"],
      ["licence", "license"],
      ["learnt", "learned"],
      ["burnt", "burned"],
      ["whilst", "while"],
      ["amongst", "among"],
      ["towards", "toward"],
      ["practise", "practice"],
      ["enquire", "inquire"],
      ["spoilt", "spoiled"],
      ["mould", "mold"],
      /*
       * **These two were reported and are not any more**, which is a decision
       * rather than a regression. VarCon marks both with a sense note — a
       * *meter* is a thing that measures and *spelt* is a species of wheat —
       * and the hand-written list shipped them anyway. A book with a gas meter
       * in it and distances in metres is not inconsistent about anything.
       */
      ["metre", "meter"],
      ["spelt", "spelled"],
    ] as const) {
      expect(finds(b, a), `${b}/${a}`).toBe(false);
    }
  });

  it("refuses an inflection of an ambiguous word too", () => {
    // The way the ambiguity walks back in: `mould` refused and `mouldy` not.
    for (const [b, a] of [
      ["moulded", "molded"],
      ["mouldy", "moldy"],
      ["moulds", "molds"],
      ["draughty", "drafty"],
      ["enquired", "inquired"],
      ["cheques", "checks"],
    ] as const) {
      expect(ambiguousPair(b, a), `${b}/${a}`).toBe(true);
    }
  });

  it("does not refuse a compound merely built on an ambiguous word", () => {
    // Nobody writes a chequebook by accident. Refusing the whole family by
    // prefix would have cost these.
    expect(ambiguousPair("chequebook", "checkbook")).toBe(false);
    expect(ambiguousPair("draughtsman", "draftsman")).toBe(false);
  });

  it("carries no pair whose two words are the same", () => {
    for (const [b, a] of SPELLING_PAIRS) expect(b).not.toBe(a);
  });

  it("carries each pair once", () => {
    const seen = new Set(SPELLING_PAIRS.map(([b, a]) => `${b}|${a}`));
    expect(seen.size).toBe(SPELLING_PAIRS.length);
  });

  it("carries only lower-case words, so the tallies can be read directly", () => {
    // The scan lower-cases every token before counting. A capital in here is a
    // pair that can never match anything, silently.
    for (const [b, a] of SPELLING_PAIRS) {
      expect(b).toMatch(/^[a-z]+$/);
      expect(a).toMatch(/^[a-z]+$/);
    }
  });
});

describe("a number written two ways", () => {
  const nums = (a: string, b: string) =>
    only([chapter("One", a), chapter("Two", b, 2)], "numbers");

  it("finds twenty against 20", () => {
    const [finding] = nums(
      "She counted twenty birds along the wire that morning.",
      "He counted 20 birds along the wire that evening.",
    );
    expect(finding.variants.map((v) => v.text).sort()).toEqual(["20", "twenty"]);
  });

  it("finds a compound written both ways", () => {
    expect(
      nums(
        "There were twenty-one of them waiting by the gate.",
        "There were 21 of them waiting by the gate.",
      ),
    ).toHaveLength(1);
  });

  /**
   * **Every one of these is a book that is not inconsistent about anything.**
   * A year, a price, a time and a percentage are all just digits until the
   * characters beside them are read, and reporting any of them would be the
   * false positive this whole module is built to avoid.
   */
  it("says nothing about a year, a price, a percentage or a time", () => {
    expect(nums("It was nineteen years.", "It was 1985 that year.")).toHaveLength(0);
    expect(nums("It cost twenty pounds.", "It cost $20 that day.")).toHaveLength(0);
    expect(nums("About twenty of them.", "About 20% of them.")).toHaveLength(0);
    expect(nums("It was eight then.", "It was 8:30 then.")).toHaveLength(0);
  });

  it("says nothing about an ordinal", () => {
    expect(
      nums("She was twenty-one that spring.", "It was the 21st of June."),
    ).toHaveLength(0);
  });

  /**
   * The guard the whole check turns on. *One* is a pronoun and a determiner
   * long before it is a number, so a book with a single `1` in it would carry a
   * finding it could never clear.
   */
  it("says nothing about the word one", () => {
    expect(
      nums(
        "One must always knock, and one day she forgot the one thing.",
        "There was 1 door left open.",
      ),
    ).toHaveLength(0);
  });

  it("says nothing when the book only writes it one way", () => {
    expect(
      nums("She counted twenty birds.", "He counted twenty more."),
    ).toHaveLength(0);
  });
});

describe("a term capitalised two ways", () => {
  const term = (upper: string, lower: string) =>
    only(
      [
        chapter("One", `${upper} ${upper} ${upper}`),
        chapter("Two", `${lower} ${lower} ${lower}`, 2),
      ],
      "capitals",
    );

  it("finds an invented term capitalised only sometimes", () => {
    const [finding] = term(
      "The men of the Council waited there.",
      "The men of the council waited there.",
    );
    expect(finding.variants.map((v) => v.text).sort()).toEqual([
      "Council",
      "council",
    ]);
  });

  /** English does both of these on purpose, on nearly every book. */
  it("says nothing about a mother, an earth or a king", () => {
    expect(
      term("She told Mother about it.", "She told her mother about it."),
    ).toHaveLength(0);
    expect(
      term("He looked at the Earth below.", "He looked at the earth below."),
    ).toHaveLength(0);
    expect(
      term("They knelt before the King today.", "They knelt before the king today."),
    ).toHaveLength(0);
  });

  /**
   * A title standing in front of a name is a different use of the word, and
   * counting it would report every book that has an office in it.
   */
  it("says nothing when the capital is a title before a name", () => {
    expect(
      term("They found Warden Blake there.", "They found the warden there."),
    ).toHaveLength(0);
  });

  it("says nothing about a word used the other way once or twice", () => {
    expect(
      only(
        [
          chapter("One", "The men of the Council waited. The Council waited. The Council rose."),
          chapter("Two", "The council waited there.", 2),
        ],
        "capitals",
      ),
    ).toHaveLength(0);
  });

  it("says nothing about a capital that only ever opens a sentence", () => {
    expect(
      only(
        [
          chapter("One", "Council business was slow. Council business was slower. Council business stopped."),
          chapter("Two", "He joined the council and the council and the council.", 2),
        ],
        "capitals",
      ),
    ).toHaveLength(0);
  });
});

describe("scene breaks", () => {
  const withBreaks = (
    title: string,
    breaks: (string | null)[],
    number: number | null = 1,
  ): BookText => ({ ...chapter(title, "The room was quiet.", number), breaks });

  it("finds a real break beside asterisks typed into a paragraph", () => {
    const [finding] = only(
      [withBreaks("One", [null, null]), withBreaks("Two", ["***"], 2)],
      "breaks",
    );
    expect(finding.variants.map((v) => v.text).sort()).toEqual(["***", REAL_BREAK]);
  });

  it("finds two typed forms that disagree", () => {
    expect(
      only([withBreaks("One", ["***"]), withBreaks("Two", ["* * *"], 2)], "breaks"),
    ).toHaveLength(1);
  });

  it("says nothing when every break is a real one", () => {
    expect(
      only([withBreaks("One", [null, null]), withBreaks("Two", [null], 2)], "breaks"),
    ).toHaveLength(0);
  });

  it("says nothing when every typed break matches", () => {
    expect(
      only([withBreaks("One", ["***"]), withBreaks("Two", ["***", "***"], 2)], "breaks"),
    ).toHaveLength(0);
  });

  it("says nothing about a book with no breaks at all", () => {
    expect(only([chapter("One", "The room was quiet.")], "breaks")).toHaveLength(0);
  });
});

describe("a word written two ways, neither of them wrong", () => {
  it("finds email beside e-mail", () => {
    const [finding] = only(
      [
        chapter("One", "She sent the e-mail before dawn."),
        chapter("Two", "She sent the email before dawn.", 2),
      ],
      "style",
    );
    expect(finding.variants.map((v) => v.text).sort()).toEqual(["e-mail", "email"]);
  });

  it("finds a pair written as two words against one", () => {
    expect(
      only(
        [
          chapter("One", "It was all right by then."),
          chapter("Two", "It was alright by then.", 2),
        ],
        "style",
      ),
    ).toHaveLength(1);
  });

  /** Two cards for one decision is the pile this module keeps refusing. */
  it("does not report email a second time as a hyphenation finding", () => {
    const book = [
      chapter("One", "She sent the e-mail before dawn."),
      chapter("Two", "She sent the email before dawn.", 2),
    ];
    expect(only(book, "hyphens")).toHaveLength(0);
  });

  /**
   * The reason this table stays short. These pairs are different words with
   * different meanings, and reporting them would be wrong on every book that
   * uses English correctly.
   */
  it("says nothing about every day against everyday", () => {
    expect(
      only(
        [
          chapter("One", "It was an everyday sort of morning."),
          chapter("Two", "She walked there every day that winter.", 2),
        ],
        "style",
      ),
    ).toHaveLength(0);
  });
});

describe("the tables, once they were grown", () => {
  const both = (a: string, b: string) =>
    only(
      [
        chapter("One", `The room was quiet and she liked the ${a} of it.`),
        chapter("Two", `The door was shut and he liked the ${b} of it.`, 2),
      ],
      "style",
    );

  /*
   * Lower bounds rather than exact sizes. A build that silently produced a stub
   * is a red test; a build that found thirty more pairs is not.
   */
  it("carries the tables it is supposed to carry", () => {
    expect(SPELLING_PAIRS.length).toBeGreaterThan(3500);
    expect(STYLE_PAIRS.length).toBeGreaterThan(40);
    expect(NAME_WORDS.size).toBeGreaterThan(1500);
  });

  it("finds a house-style pair in the form the book actually wrote it", () => {
    // Seventeen base forms found `e-mail` against `email` and were blind to
    // every inflection of it, which is what AGID was brought in for.
    expect(both("e-mails", "emails")).toHaveLength(1);
    expect(both("e-mailed", "emailed")).toHaveLength(1);
  });

  it("finds the noun-against-verb pairs nobody thinks of", () => {
    expect(both("web sites", "websites")).toHaveLength(1);
  });

  it("says nothing about a word that is also somebody's name", () => {
    // A character called Rose in a book with roses in it is not an error, and
    // it is the commonest thing this check would otherwise fire on.
    const rose = only(
      [
        chapter("One", "The men saw Rose again. They saw Rose. They asked Rose."),
        chapter("Two", "He cut a rose there, and a rose, and a rose.", 2),
      ],
      "capitals",
    );
    expect(rose).toHaveLength(0);
  });

  it("still reports an invented term the writer capitalised only sometimes", () => {
    // The case the whole check exists for has to survive the stoplist.
    expect(
      only(
        [
          chapter("One", "The men of the Council met. The Council rose. The Council spoke."),
          chapter("Two", "The men of the council met, and the council rose, and the council spoke.", 2),
        ],
        "capitals",
      ),
    ).toHaveLength(1);
  });

  it("finds a number in the hundreds", () => {
    const found = only(
      [
        chapter("One", "There were two hundred of them on the road."),
        chapter("Two", "There were 200 of them on the road.", 2),
      ],
      "numbers",
    );
    expect(found).toHaveLength(1);
  });

  /**
   * The band that had to be refused outright: 1000 to 2100 are round numbers
   * *and* the years a novel is most likely to name.
   */
  it("says nothing about a year, however round", () => {
    for (const [word, digits] of [
      ["two thousand", "2000"],
      ["nineteen hundred", "1900"],
    ] as const) {
      expect(
        only(
          [
            chapter("One", `It was ${word} that summer.`),
            chapter("Two", `It was ${digits} that summer.`, 2),
          ],
          "numbers",
        ),
        digits,
      ).toHaveLength(0);
    }
  });

  it("says nothing about a number that is not round", () => {
    expect(
      only(
        [
          chapter("One", "There were two hundred and six of them."),
          chapter("Two", "There were 206 of them.", 2),
        ],
        "numbers",
      ),
    ).toHaveLength(0);
  });

  it("says nothing about a compound English writes both ways", () => {
    // `far-off` and `far off` are both correct, and which one is right depends
    // on where in the sentence it sits.
    expect(
      only(
        [
          chapter("One", "It was a far-off country beyond the hills."),
          chapter("Two", "The country was far off beyond the hills.", 2),
        ],
        "hyphens",
      ),
    ).toHaveLength(0);
  });

  it("says nothing about a noun and the verb it came from", () => {
    // You set up a setup. Two words, not one word written two ways.
    expect(
      only(
        [
          chapter("One", "He checked the set-up before dawn."),
          chapter("Two", "He had to set up the room before dawn.", 2),
        ],
        "hyphens",
      ),
    ).toHaveLength(0);
  });

  it("says nothing about a word doubled on purpose", () => {
    expect(
      only([chapter("One", "What it is is a problem, and he did do it.")], "doubled"),
    ).toHaveLength(0);
  });
});

describe("a near-miss of a word you use", () => {
  /** A small stand-in for the megabyte the browser fetches. */
  const english = new Set([
    "room", "rooms", "form", "from", "works", "words", "stage", "state",
    "quiet", "waited", "door", "light", "bright", "held", "night",
  ]);

  const near = (book: BookText[], words = english) =>
    consistencyReport(book, { only: ["typos"], words }).findings;

  const uses = (word: string, times: number) =>
    Array.from(
      { length: times },
      (_, i) => `The light of the ${word} was bright at ${i}.`,
    ).join(" ");

  it("finds a lower-case invented word mistyped once", () => {
    const [finding] = near([
      chapter("One", uses("aetherium", 20)),
      chapter("Two", "She held the aetherius up to the light.", 2),
    ]);
    expect(finding.label).toContain("aetherius");
    expect(finding.label).toContain("aetherium");
  });

  it("finds it capitalised too, and shows it as the book writes it", () => {
    const [finding] = near([
      chapter("One", uses("Aetherium", 20)),
      chapter("Two", "She held the Aetherius up to the light.", 2),
    ]);
    // Not `aetherium` — the count is case-insensitive, the card is not.
    expect(finding.variants.map((v) => v.text).sort()).toEqual([
      "Aetherium",
      "Aetherius",
    ]);
  });

  /** The gap this check exists for: below the name check's floor of eight. */
  it("finds one where the correct spelling is used only three times", () => {
    expect(
      near([
        chapter("One", uses("Valdoren", 3)),
        chapter("Two", "The road to Valdorem was long.", 2),
      ]),
    ).toHaveLength(1);
  });

  it("finds a plain typo of an ordinary word", () => {
    expect(
      near([
        chapter("One", uses("room", 10)),
        chapter("Two", "The rooom was quiet and she waited by the door.", 2),
      ]),
    ).toHaveLength(1);
  });

  /**
   * **The half that matters.** Every one of these is two real English words,
   * and without the list they were exactly what came back — measured at 162
   * findings on Pride and Prejudice and 757 on Moby Dick.
   */
  it("says nothing about two words that are both English", () => {
    for (const [rare, common] of [
      ["form", "from"],
      ["works", "words"],
      ["stage", "state"],
    ] as const) {
      expect(
        near([
          chapter("One", uses(common, 20)),
          chapter("Two", `She thought about the ${rare} of it.`, 2),
        ]),
        `${rare}/${common}`,
      ).toHaveLength(0);
    }
  });

  it("says nothing about a name one letter from an ordinary word", () => {
    // Sebond against second, Tooke against took — four of Moby Dick's ten
    // findings before this guard, and not one of them a mistake.
    expect(
      near([
        chapter("One", uses("second", 20)),
        chapter("Two", "He quoted Sebond at length that evening.", 2),
      ]),
    ).toHaveLength(0);
  });

  it("says nothing about a word used more than twice", () => {
    expect(
      near([
        chapter("One", uses("aetherium", 20)),
        chapter("Two", uses("aetherius", 3), 2),
      ]),
    ).toHaveLength(0);
  });

  it("says nothing about a word under five letters", () => {
    expect(
      near([chapter("One", uses("bant", 20)), chapter("Two", "A bent thing.", 2)]),
    ).toHaveLength(0);
  });

  /**
   * **The loud failure.** The list is fetched, the editor works offline, and a
   * check that could not run must never be counted as one that found nothing.
   */
  it("does not run at all when there is no word list", () => {
    const report = consistencyReport(
      [
        chapter("One", uses("aetherium", 20)),
        chapter("Two", "She held the aetherius up to the light.", 2),
      ],
      { only: ["typos"] },
    );
    expect(report.ran).toEqual([]);
    expect(report.findings).toHaveLength(0);
  });

  it("leaves the other checks alone when the word list is missing", () => {
    const report = consistencyReport(
      [
        chapter("One", "She liked the colour grey."),
        chapter("Two", "She liked the color grey.", 2),
      ],
      { only: ["spelling", "typos"] },
    );
    expect(report.ran).toEqual(["spelling"]);
    expect(report.findings.length).toBeGreaterThan(0);
  });
});

/**
 * The six defects an audit against the running engine turned up, each pinned by
 * the probe that found it. Three of them were introduced by the near-miss check
 * and the guard written to quieten it.
 */
describe("the six gaps", () => {
  const DICT = new Set([
    "room", "rooms", "light", "bright", "held", "road", "long", "second",
    "shelf", "glittered", "quiet", "waited", "door", "riders", "more", "left",
  ]);
  const uses = (w: string, n: number) =>
    Array.from({ length: n }, (_, i) => `The light of the ${w} was bright at ${i}.`).join(" ");

  it("gives one card for one problem, not one per check", () => {
    // `names` and `typos` both see a capitalised invented word mistyped once.
    const report = consistencyReport(
      [
        chapter("One", uses("Aetherium", 20)),
        chapter("Two", "She held the Aetherius here.", 2),
      ],
      { words: DICT },
    );
    const cards = report.findings.filter((f) =>
      f.label.toLowerCase().includes("aetheri"),
    );
    expect(cards).toHaveLength(1);
    // The flagship keeps it — `ALL_CHECKS` is the order they are read in.
    expect(cards[0].check).toBe("names");
  });

  it("shows the spelling the book actually uses, not a sentence opener", () => {
    // `Room after room` — the first sighting is capitalised and the book is not.
    const [finding] = consistencyReport(
      [
        chapter("One", `Room after room stood empty. ${uses("room", 10)}`),
        chapter("Two", "The rooom was quiet here.", 2),
      ],
      { only: ["typos"], words: DICT },
    ).findings;
    expect(finding.label).toContain("room");
    expect(finding.label).not.toContain("Room");
  });

  /** The worst of the six: a typo invisible purely because of where it sat. */
  it("finds a typo that opens a sentence", () => {
    expect(
      consistencyReport(
        [
          chapter("One", uses("aetherium", 20)),
          chapter("Two", "Aetherius glittered on the shelf.", 2),
        ],
        { only: ["typos"], words: DICT },
      ).findings,
    ).toHaveLength(1);
  });

  it("still refuses a name that is one letter from an ordinary word", () => {
    // The pair the guard exists for. Fixing the miss above must not cost this.
    expect(
      consistencyReport(
        [
          chapter("One", uses("second", 20)),
          chapter("Two", "He quoted Sebond at length that evening.", 2),
        ],
        { only: ["typos"], words: DICT },
      ).findings,
    ).toHaveLength(0);
  });

  it("finds a mistyped hyphenated invented word", () => {
    expect(
      consistencyReport(
        [
          chapter("One", uses("sky-glass", 20)),
          chapter("Two", "She held the sky-glasse here.", 2),
        ],
        { only: ["typos"], words: DICT },
      ).findings,
    ).toHaveLength(1);
  });

  it("checks a term that is only ever used inside a two-word name", () => {
    // `Council` never stands alone, and `chamber` is nobody's name.
    expect(
      consistencyReport(
        [
          chapter("One", "The men of the Council Chamber met. The Council Chamber was cold. The Council Chamber stood."),
          chapter("Two", "The council met, and the council rose, and the council spoke.", 2),
        ],
        { only: ["capitals"] },
      ).findings,
    ).toHaveLength(1);
  });

  it("still refuses a title standing before a name", () => {
    // `blake` is a known name, so the guard holds where it should.
    expect(
      consistencyReport(
        [
          chapter("One", "They found Warden Blake there. Warden Blake waited. Warden Blake spoke."),
          chapter("Two", "They found the warden there, and the warden waited, and the warden spoke.", 2),
        ],
        { only: ["capitals"] },
      ).findings,
    ).toHaveLength(0);
  });

  /*
   * Both of these came back the moment hyphenated words were let in, because
   * **no hyphenated word is in any dictionary**, so the test that quietens the
   * rest of this check waved every one of them through. Measured: Pride and
   * Prejudice went from nothing to these two.
   */
  it("says nothing about a hyphen opening and closing", () => {
    // twelve-month against twelvemonth is a hyphenation finding, not a typo.
    expect(
      consistencyReport(
        [
          chapter("One", uses("twelvemonth", 20)),
          chapter("Two", "She waited a twelve-month for the road.", 2),
        ],
        { only: ["typos"], words: new Set([...DICT, "twelvemonth"]) },
      ).findings,
    ).toHaveLength(0);
  });

  it("says nothing about a compound pluralised in the middle", () => {
    // English puts the s inside: son-in-law, sons-in-law. The plural guard
    // looks at the end of a word and walked straight past it.
    expect(
      consistencyReport(
        [
          chapter("One", uses("son-in-law", 20)),
          chapter("Two", "Her sons-in-law waited by the road.", 2),
        ],
        { only: ["typos"], words: DICT },
      ).findings,
    ).toHaveLength(0);
  });

  it("says nothing about hundred when the book only wrote two hundred", () => {
    // Two hundred is not one hundred, and `hundred` was only ever a compound.
    expect(
      consistencyReport(
        [
          chapter("One", "There were two hundred riders and two hundred more."),
          chapter("Two", "There were 100 riders left.", 2),
        ],
        { only: ["numbers"] },
      ).findings,
    ).toHaveLength(0);
  });

  it("still finds a hundred against 100", () => {
    expect(
      consistencyReport(
        [
          chapter("One", "There were a hundred riders on the road."),
          chapter("Two", "There were 100 riders on the road.", 2),
        ],
        { only: ["numbers"] },
      ).findings,
    ).toHaveLength(1);
  });
});
