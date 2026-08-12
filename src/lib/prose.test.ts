import { describe, expect, it } from "vitest";
import {
  combinedRates,
  echoes,
  isNotable,
  proseReport,
  sentencesIn,
} from "./prose";

const find = (text: string, id: string) =>
  proseReport(text).findings.find((f) => f.id === id);

describe("sentencesIn", () => {
  it("splits on terminal punctuation", () => {
    expect(sentencesIn("One. Two! Three?")).toHaveLength(3);
  });

  it("splits on an ellipsis", () => {
    expect(sentencesIn("She waited… He did not.")).toHaveLength(2);
  });
});

describe("proseReport — the counts", () => {
  it("counts words, sentences and paragraphs", () => {
    const report = proseReport("One two three.\n\nFour five.");
    expect(report.words).toBe(5);
    expect(report.sentences).toBe(2);
    expect(report.paragraphs).toBe(2);
  });

  it("averages sentence length and finds the longest", () => {
    const report = proseReport("Short. One two three four five six.");
    expect(report.longestSentence).toBe(6);
    expect(report.averageSentence).toBe(3.5);
  });

  it("has nothing to say about nothing", () => {
    const report = proseReport("");
    expect(report.words).toBe(0);
    expect(report.findings).toEqual([]);
  });
});

describe("proseReport — dialogue tags", () => {
  it("finds tags that are not said", () => {
    const finding = find(
      '"Never," she retorted. "Not once," he chuckled.',
      "tags",
    )!;
    expect(finding.count).toBe(2);
    expect(finding.examples).toContain("retorted");
  });

  /**
   * The count of alternatives means nothing without knowing how much "said"
   * there is beside it — two exclaims in a chapter of four hundred saids is a
   * different fact from two in a chapter of six.
   */
  it("says how much “said” there is beside them", () => {
    const finding = find('"A," she said. "B," he said. "C," she hissed.', "tags")!;
    expect(finding.note).toContain("2 times");
  });

  it("says nothing when every tag is said", () => {
    expect(find('"A," she said. "B," he said.', "tags")).toBeUndefined();
  });
});

describe("proseReport — adverbs and filter words", () => {
  it("finds -ly words and reports a rate", () => {
    const finding = find("She walked slowly and spoke quietly.", "adverbs")!;
    expect(finding.count).toBe(2);
    expect(finding.per1000).toBeGreaterThan(0);
  });

  it("finds filter words", () => {
    const finding = find("She saw the door open. He felt the cold.", "filters")!;
    expect(finding.count).toBe(2);
    expect(finding.examples).toEqual(expect.arrayContaining(["saw", "felt"]));
  });

  it("does not match a filter word inside a longer word", () => {
    expect(find("The sawmill and the feltmaker.", "filters")).toBeUndefined();
  });
});

describe("proseReport — repeated openers", () => {
  /**
   * Obvious on a printed page and nearly impossible to notice while writing —
   * which is the whole reason a machine is any use here.
   */
  it("finds three sentences in a row starting the same way", () => {
    const finding = find(
      "She waited. She listened. She went inside.",
      "openers",
    )!;
    expect(finding.examples).toContain("she");
  });

  it("leaves two in a row alone", () => {
    expect(find("She waited. She listened. He went inside.", "openers")).toBeUndefined();
  });

  it("ignores an opening quotation mark when comparing", () => {
    const finding = find(
      '“Never,” she said. “Never,” he said. “Never,” they said.',
      "openers",
    );
    expect(finding?.examples).toContain("never");
  });
});

describe("proseReport — long sentences", () => {
  it("counts sentences over forty-five words", () => {
    const long = `${"word ".repeat(50)}.`;
    expect(find(long, "long")?.count).toBe(1);
  });

  it("leaves ordinary sentences alone", () => {
    expect(find("A perfectly normal sentence of modest length.", "long")).toBeUndefined();
  });
});

describe("rhythm", () => {
  const text = "One two three. Four five. Six seven eight nine.";

  it("carries every sentence in reading order", () => {
    // The order is the information: a distribution says how long the sentences
    // are, this says where they fall, and three long ones together read as a
    // wall however ordinary the average is.
    expect(proseReport(text).rhythm.map((s) => s.text)).toEqual([
      "One two three.",
      "Four five.",
      "Six seven eight nine.",
    ]);
  });

  it("measures each one, and agrees with the totals beside it", () => {
    const report = proseReport(text);
    expect(report.rhythm.map((s) => s.words)).toEqual([3, 2, 4]);
    expect(report.rhythm).toHaveLength(report.sentences);
    expect(Math.max(...report.rhythm.map((s) => s.words))).toBe(
      report.longestSentence,
    );
  });

  it("is empty for empty text rather than holding a blank sentence", () => {
    expect(proseReport("   ").rhythm).toEqual([]);
  });
});

describe("showing where, not only how many", () => {
  const long = (n: number) => `${Array.from({ length: n }, () => "word").join(" ")}.`;

  /**
   * The one not to "fix" by deleting.
   *
   * This finding shipped with an empty `examples` for its whole life: it said
   * three sentences were over the line and showed none of them, which is the
   * single finding here where seeing the instance is the entire point. A count
   * a writer cannot act on is trivia.
   */
  it("hands back the long sentences it counted", () => {
    const report = proseReport(`Short one. ${long(50)} Short two. ${long(60)}`);
    const finding = report.findings.find((f) => f.id === "long");
    expect(finding).toBeDefined();
    expect(finding!.passages).toHaveLength(finding!.count);
    for (const passage of finding!.passages!) {
      expect(passage.words).toBeGreaterThan(45);
      expect(passage.text.length).toBeGreaterThan(0);
    }
  });

  it("puts the worst offender first", () => {
    // Somebody reading three of these wants the longest at the top, not
    // whichever happened to come first in the chapter.
    const report = proseReport(`${long(50)} ${long(70)} ${long(60)}`);
    const words = report.findings
      .find((f) => f.id === "long")!
      .passages!.map((p) => p.words);
    expect(words).toEqual([...words].sort((a, b) => b - a));
  });

  it("hands back the run of sentences that start the same way", () => {
    // The note promises it "just says where", and the only thing it used to
    // say was which word.
    const finding = find("She ran. She stopped. She waited. Then rain fell.", "openers");
    expect(finding).toBeDefined();
    expect(finding!.passages).toHaveLength(3);
    expect(finding!.passages![0].text).toBe("She ran.");
  });

  it("shows a word-counting finding in the sentences it lives in", () => {
    // A word on its own cannot be acted on. "You used 'felt' twice" is not a
    // finding; "She felt the cold" against "the cold got in" is a decision,
    // and it is a decision about a sentence.
    const finding = find("She felt the cold. Rain fell on the roof.", "filters");
    expect(finding!.examples).toContain("felt");
    expect(finding!.passages?.[0].text).toBe("She felt the cold.");
    expect(finding!.passages?.[0].mark).toBe("felt");
  });

  it("does not show the same sentence twice for two words in it", () => {
    const finding = find("She saw it and she knew.", "filters");
    expect(finding!.passages).toHaveLength(1);
  });
});

describe("echoes", () => {
  it("hears a distinctive word used twice in a breath", () => {
    // The pain every source names and no count of adverbs touches: writers
    // repeat their favourite words, it is invisible on screen, and it is
    // unmistakable read aloud.
    const found = echoes("The lantern swung low. She raised the lantern again.");
    expect(found.map((e) => e.word)).toContain("lantern");
    expect(found.find((e) => e.word === "lantern")!.count).toBe(2);
  });

  it("says nothing about the words English repeats by itself", () => {
    // "the" nine times in a paragraph is the language working, not the writer
    // failing, and leaving them in would bury the one that matters.
    expect(echoes("The door and the window and the wall and the floor.")).toEqual(
      [],
    );
  });

  it("ignores a word used once at each end of the chapter", () => {
    // A motif or a coincidence, not something a reader trips over.
    const far = `lantern ${"pad ".repeat(200)} lantern`;
    expect(echoes(far)).toEqual([]);
  });

  it("counts only the uses that are actually near each other", () => {
    // Two together and one far away is an echo of two, not of three —
    // overstating it would misdescribe what the writer is being shown.
    const text = `lantern lantern ${"pad ".repeat(200)} lantern`;
    expect(echoes(text)[0].count).toBe(2);
  });

  it("puts the loudest first, and is stable between runs", () => {
    const text = "harbour harbour harbour lantern lantern";
    expect(echoes(text).map((e) => e.word)).toEqual(["harbour", "lantern"]);
  });

  it("leaves very short words alone", () => {
    expect(echoes("She saw him and she saw him again.")).toEqual([]);
  });
});

describe("isNotable", () => {
  const finding = (per1000?: number) =>
    ({ id: "x", label: "x", count: 1, note: "x", examples: [], per1000 }) as never;

  it("is quiet about a chapter that writes the way the book writes", () => {
    // One adverb in six hundred words got a full card, a heading, a rate and a
    // paragraph saying one adverb is not a problem — at exactly the volume of
    // the finding beside it that mattered. When everything is raised, nothing
    // is.
    expect(isNotable(finding(1.5), 5.1)).toBe(false);
    expect(isNotable(finding(5.1), 5.1)).toBe(false);
  });

  it("raises a chapter doing something it does not do elsewhere", () => {
    expect(isNotable(finding(9), 5.1)).toBe(true);
  });

  it("always raises a finding that has no rate to compare", () => {
    // Structural rather than statistical: three sentences opening the same way
    // is worth seeing once, and there is no per-thousand figure for it.
    expect(isNotable(finding(undefined), 5.1)).toBe(true);
  });

  it("always raises when there is nothing to compare against", () => {
    // Quieting a finding on the strength of a comparison that was never made
    // would be hiding it.
    expect(isNotable(finding(1.5), undefined)).toBe(true);
  });
});

describe("combinedRates", () => {
  it("is the writer's own book, counted the same way", () => {
    // The only comparison this app can make honestly. A benchmark against
    // "good prose" would be invented; a writer's own average across their own
    // chapters is measured, and it answers the question they actually have —
    // is *this* chapter unusual for me?
    const reports = [
      proseReport("She felt cold."),
      proseReport("Rain fell. Wind rose. Nothing happened at all here."),
    ];
    const rates = combinedRates(reports);
    // One "felt" across the twelve words of both chapters — 3 and 9.
    expect(rates.filters).toBeCloseTo((1 / 12) * 1000, 1);
  });

  it("has nothing to say about a book with no words", () => {
    expect(combinedRates([])).toEqual({});
    expect(combinedRates([proseReport("")])).toEqual({});
  });
});

describe("what it refuses to do", () => {
  /**
   * The rule the whole module exists under. A number out of a hundred for
   * prose would be invented to look like an answer, and this product's
   * position is that it does not do that.
   */
  it("produces no score, grade or rating of any kind", () => {
    const report = proseReport(
      "She saw the door open. She felt cold. She retorted slowly.",
    );
    expect(Object.keys(report)).not.toContain("score");
    expect(Object.keys(report)).not.toContain("grade");
    expect(Object.keys(report)).not.toContain("rating");
  });

  /** Every finding is a count of something, and says why anyone mentions it. */
  it("gives every finding a count and a reason", () => {
    const report = proseReport(
      'She saw it. "Never," he retorted. She walked slowly and quietly.',
    );
    expect(report.findings.length).toBeGreaterThan(0);
    for (const finding of report.findings) {
      expect(finding.count).toBeGreaterThan(0);
      expect(finding.note.length).toBeGreaterThan(20);
    }
  });
});
