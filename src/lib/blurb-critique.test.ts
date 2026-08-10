import { describe, expect, it } from "vitest";
import {
  CRITIQUE_SYSTEM,
  MAX_QUESTIONS,
  critiquePrompt,
  parseCritique,
} from "./blurb-critique";

const one = (about: string, note: string) => ({ about, note });

describe("parseCritique", () => {
  it("reads a clean reply", () => {
    const raw = JSON.stringify({
      questions: [one("The antagonist", "Nothing is said about who opposes her.")],
    });
    expect(parseCritique(raw).questions).toEqual([
      { about: "The antagonist", note: "Nothing is said about who opposes her." },
    ]);
  });

  it("reads it out of a preamble and a code fence", () => {
    const raw = [
      "Here is what a reader would ask:",
      "```json",
      JSON.stringify({ questions: [one("Stakes", "It never says what she loses.")] }),
      "```",
    ].join("\n");
    expect(parseCritique(raw).questions).toHaveLength(1);
  });

  it("reads a bare array", () => {
    const raw = JSON.stringify([one("Setting", "The place is never named.")]);
    expect(parseCritique(raw).questions).toHaveLength(1);
  });

  it("keeps a bare array whole rather than parsing its first element", () => {
    // The bracket scan finds `{` before `[` in a bare array, and slicing from
    // there yields one row parsed as the entire reply.
    const raw = `Sure!\n${JSON.stringify([
      one("Stakes", "Nothing is at risk."),
      one("Setting", "The place is never named."),
    ])}`;
    expect(parseCritique(raw).questions).toHaveLength(2);
  });

  it("is empty when the model answered with nothing usable", () => {
    expect(parseCritique("I could not find anything.").questions).toEqual([]);
    expect(parseCritique("").questions).toEqual([]);
    expect(parseCritique("{}").questions).toEqual([]);
  });

  it("drops a row missing either half", () => {
    const raw = JSON.stringify({
      questions: [
        { about: "Stakes" },
        { note: "Nothing is at risk." },
        { about: "", note: "Nothing is at risk." },
        one("Setting", "The place is never named."),
      ],
    });
    expect(parseCritique(raw).questions).toEqual([
      { about: "Setting", note: "The place is never named." },
    ]);
  });

  it("drops a repeated label", () => {
    const raw = JSON.stringify({
      questions: [
        one("Stakes", "Nothing is at risk."),
        one("stakes", "Still nothing is at risk."),
      ],
    });
    expect(parseCritique(raw).questions).toHaveLength(1);
  });

  it("caps the list", () => {
    const raw = JSON.stringify({
      questions: Array.from({ length: MAX_QUESTIONS + 4 }, (_, i) =>
        one(`Point ${i}`, "Something is missing."),
      ),
    });
    expect(parseCritique(raw).questions).toHaveLength(MAX_QUESTIONS);
  });

  /*
   * The two that are the feature rather than hygiene. This screen exists
   * because the app refuses to write the blurb, so a parsed question may
   * carry no score to rank it by and no copy to paste. Both of these are
   * tests not to "fix": if either goes green with the assertion relaxed, the
   * refusal has stopped being enforced anywhere.
   */
  it("carries nothing but the label and the note", () => {
    const raw = JSON.stringify({
      questions: [
        {
          about: "Stakes",
          note: "Nothing is at risk.",
          score: 4,
          rating: "weak",
          grade: "C",
          suggestion: "Try: 'When the tide turns, she loses everything.'",
          rewrite: "A rewritten blurb.",
        },
      ],
    });
    expect(parseCritique(raw).questions).toEqual([
      { about: "Stakes", note: "Nothing is at risk." },
    ]);
  });

  it("drops a note long enough to be replacement copy", () => {
    // A model told not to write the missing sentence will eventually write it
    // into the note. Anything that long is not a note, and it is dropped
    // rather than truncated — a sentence cut mid-clause reads as our bug.
    const smuggled = "Here is how it could open. ".repeat(20);
    const raw = JSON.stringify({
      questions: [
        one("Opening", smuggled),
        one("Stakes", "Nothing is at risk."),
      ],
    });
    expect(parseCritique(raw).questions).toEqual([
      { about: "Stakes", note: "Nothing is at risk." },
    ]);
  });
});

describe("the prompt", () => {
  it("sends the blurb, the title and the genre", () => {
    const prompt = critiquePrompt({
      blurb: "A woman returns to the island.",
      title: "The Salt Ledger",
      genre: "Mystery",
    });
    expect(prompt).toContain("The Salt Ledger");
    expect(prompt).toContain("Mystery");
    expect(prompt).toContain("A woman returns to the island.");
  });

  it("says so rather than leaving a blank when either is unset", () => {
    const prompt = critiquePrompt({ blurb: "A woman returns to the island." });
    expect(prompt).toContain("has not set a title");
    expect(prompt).toContain("has not set a genre");
  });

  it("asks for no rewriting and no score", () => {
    // The prompt is a request rather than a guarantee — the parser is what
    // enforces both — but asking for the wrong thing and filtering it out
    // afterwards wastes the tokens and invites the model to argue.
    expect(CRITIQUE_SYSTEM).toMatch(/Do NOT write the missing part/);
    expect(CRITIQUE_SYSTEM).toMatch(/NO score, rating, grade/);
  });
});
