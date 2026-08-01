import { describe, expect, it } from "vitest";
import { proseReport, sentencesIn } from "./prose";

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
