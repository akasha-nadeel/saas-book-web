import { describe, expect, it } from "vitest";
import {
  blurbReport,
  paragraphsOf,
  sentencesOf,
  statsOf,
  wordsOf,
} from "./blurb";
import { BLURB_MAX } from "./publishing";

const problems = (blurb: string, options = {}) =>
  blurbReport(blurb, options).issues.filter((i) => i.level === "problem");
const notes = (blurb: string, options = {}) =>
  blurbReport(blurb, options).issues.filter((i) => i.level === "note");
const fields = (blurb: string, options = {}) =>
  blurbReport(blurb, options).issues.map((i) => i.field);

describe("paragraphsOf", () => {
  it("splits on blank lines", () => {
    expect(paragraphsOf("One.\n\nTwo.\n\nThree.")).toHaveLength(3);
  });

  /**
   * The case this exists for. Writers paste out of word processors that
   * hard-wrap, and counting every wrapped line would report a four-paragraph
   * blurb as twenty-six.
   */
  it("does not treat a wrapped line as a new paragraph", () => {
    expect(paragraphsOf("A wrapped\nline of prose.")).toHaveLength(1);
  });
});

describe("sentencesOf", () => {
  it("splits on terminal punctuation", () => {
    expect(sentencesOf("She left. He stayed. Nobody spoke.")).toHaveLength(3);
  });

  it("keeps an abbreviation in one piece", () => {
    expect(sentencesOf("Mr. Kelly went home.")).toHaveLength(1);
  });

  it("keeps a decimal in one piece", () => {
    expect(sentencesOf("It cost 3.5 million.")).toHaveLength(1);
  });

  it("starts a new sentence at an opening quote", () => {
    expect(sentencesOf('She stopped. "Not here," he said.')).toHaveLength(2);
  });
});

describe("statsOf", () => {
  it("counts what it says it counts", () => {
    const stats = statsOf("One two three.\n\nFour five.");
    expect(stats.words).toBe(5);
    expect(stats.paragraphs).toBe(2);
    expect(stats.longestParagraph).toBe("One two three.".length);
  });

  it("reports an empty blurb as zero rather than one word", () => {
    expect(wordsOf("   ")).toBe(0);
    expect(statsOf("   ").characters).toBe(0);
  });

  it("measures the longest sentence in words", () => {
    expect(statsOf("Short. One two three four five.").longestSentence).toBe(5);
  });
});

describe("blurbReport — the two facts", () => {
  it("calls an empty blurb a problem, and stops there", () => {
    const report = blurbReport("");
    expect(report.issues).toHaveLength(1);
    expect(report.issues[0].level).toBe("problem");
  });

  it("calls a blurb over the limit a problem, and says how much to cut", () => {
    const [issue] = problems("x".repeat(BLURB_MAX + 12));
    expect(issue.message).toContain("12");
  });

  it("leaves a blurb exactly at the limit alone", () => {
    expect(problems("x".repeat(BLURB_MAX))).toHaveLength(0);
  });
});

describe("blurbReport — observations", () => {
  /**
   * The rule the whole module is built on: one fact, everything else a note.
   * A tool that calls a three-paragraph blurb wrong is doing the thing this
   * product exists not to do.
   */
  it("never raises a problem for anything but length and emptiness", () => {
    const bad =
      "THE DROWNED COAST is a book. " +
      "It has a sentence that goes on and on and on and on and on and on and on and on and on and on and on and on and on and on and on and on and on and on and on and on and on and on for ever.";
    expect(problems(bad, { title: "The Drowned Coast" })).toHaveLength(0);
    expect(notes(bad, { title: "The Drowned Coast" }).length).toBeGreaterThan(0);
  });

  it("compares length against real books when it has them", () => {
    const [note] = notes("x".repeat(700), { benchmark: 700 });
    expect(note.message).toContain("usual range");
  });

  it("says when a blurb is much shorter than comparable books", () => {
    const [note] = notes("A short blurb.", { benchmark: 900 });
    expect(note.message).toContain("unusual");
  });

  it("says when a blurb is much longer than comparable books", () => {
    const [note] = notes("x".repeat(2000), { benchmark: 900 });
    expect(note.message).toContain("skimmed");
  });

  it("says nothing about length with no books to compare against", () => {
    expect(fields("A perfectly ordinary blurb.")).not.toContain("Length");
  });

  it("notices a blurb opening with the book's own title", () => {
    expect(
      fields("The Drowned Coast is a novel about maps.", {
        title: "The Drowned Coast",
      }),
    ).toContain("Opening");
  });

  it("does not mind the title appearing later on", () => {
    expect(
      fields("A cartographer returns to The Drowned Coast.", {
        title: "The Drowned Coast",
      }),
    ).not.toContain("Opening");
  });

  it("notices one long unbroken block", () => {
    expect(fields("x ".repeat(400))).toContain("Shape");
  });

  it("does not mind a long blurb that is broken up", () => {
    const paragraph = "x ".repeat(160);
    expect(fields(`${paragraph}\n\n${paragraph}`)).not.toContain("Shape");
  });

  it("notices a run of shouting", () => {
    expect(fields("THE DROWNED COAST is a novel about maps.")).toContain(
      "Capitals",
    );
  });

  /**
   * A single upper-case word cannot be told from shouting — NASA and NOVEL are
   * the same shape — so it is deliberately not flagged. A check that calls an
   * acronym a mistake is noise, and noise gets ignored along with the checks
   * that matter.
   */
  it("leaves a lone acronym alone", () => {
    expect(fields("A story of NASA and the coast.")).not.toContain("Capitals");
  });

  it("leaves roman numerals alone", () => {
    expect(fields("The sequel, part XVIII, is out.")).not.toContain("Capitals");
  });

  it("leaves an ordinary blurb with nothing to say but the length", () => {
    const ordinary =
      "When the lighthouse keeper vanishes, a cartographer is sent to chart a coast that will not hold still.\n\nWhat she finds there has been waiting a long time.";
    expect(problems(ordinary)).toHaveLength(0);
    expect(notes(ordinary)).toHaveLength(0);
  });
});
