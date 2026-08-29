import { describe, expect, it } from "vitest";

import {
  consistencyReport,
  driftKey,
  looksLikeDrift,
  withinOneEdit,
  type BookText,
  type CheckId,
} from "./consistency";

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

    expect(finding.variants[0].where).toEqual([
      { chapterId: "one", chapterTitle: "One", number: 1, count: 12 },
    ]);
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
