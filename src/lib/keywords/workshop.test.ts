import { describe, expect, it } from "vitest";
import { SLOT_MAX } from "@/lib/keywords";
import { keepUsable } from "./suggest";
import {
  buildWorkshopPrompt,
  extractKeywords,
  replyWithoutKeywords,
  WORKSHOP_SYSTEM,
} from "./workshop";

const LISTING = { title: "The Salt Road", author: "Marguerite Hale" };

const tagged = (...phrases: string[]) =>
  `Here are a few.\n<keywords>\n${phrases.join("\n")}\n</keywords>`;

describe("the candidates in a reply", () => {
  it("takes the phrases out of the tag", () => {
    expect(extractKeywords(tagged("coastal noir", "island detective"))).toEqual([
      "coastal noir",
      "island detective",
    ]);
  });

  /*
   * **Null, not an empty list, and the difference is the button.** A turn that
   * answers a question is offering nothing, so there is nothing to press; a
   * tag that came back empty is a failure and reads the same way to the
   * screen. Both are absent rather than an empty list to press on.
   */
  it("answers null when the reply is only an answer", () => {
    expect(extractKeywords("Seven boxes, fifty characters each.")).toBeNull();
  });

  it("answers null for a tag with nothing in it", () => {
    expect(extractKeywords("<keywords>\n\n</keywords>")).toBeNull();
  });

  // Generated text is hostile input — the same list `suggest.ts` and `rank.ts`
  // keep, because these are shapes a model has actually produced.
  it("survives a code fence inside the tag", () => {
    expect(extractKeywords("<keywords>```\ncoastal noir\n```</keywords>")).toEqual([
      "coastal noir",
    ]);
  });

  it("takes the first tag when a reply carries two", () => {
    const reply = `${tagged("coastal noir")}\n${tagged("something else")}`;
    expect(extractKeywords(reply)).toEqual(["coastal noir"]);
  });

  it("splits a comma-separated line, which the prompt did not ask for", () => {
    expect(extractKeywords("<keywords>coastal noir, island detective</keywords>")).toEqual(
      ["coastal noir", "island detective"],
    );
  });

  it("ignores an unclosed tag rather than swallowing the reply", () => {
    expect(extractKeywords("<keywords>coastal noir")).toBeNull();
  });
});

describe("the bubble", () => {
  it("shows the words without the tag", () => {
    expect(replyWithoutKeywords(tagged("coastal noir"))).toBe("Here are a few.");
  });

  it("strips a stray tag so the tail is not left as markup", () => {
    expect(replyWithoutKeywords("Try these: <keywords>coastal noir")).toBe(
      "Try these: coastal noir",
    );
  });

  it("leaves an ordinary answer alone", () => {
    const answer = "Seven boxes, fifty characters each.";
    expect(replyWithoutKeywords(answer)).toBe(answer);
  });
});

/*
 * **The chat and the seven boxes must not disagree about what a good keyword
 * is.** The filter under both is the same function, so a phrase the checker
 * would flag cannot be offered by the conversation sitting above it.
 */
describe("what survives the checker", () => {
  const usable = (reply: string) => keepUsable(extractKeywords(reply) ?? [], LISTING);

  it("drops a phrase repeating the title", () => {
    expect(usable(tagged("the salt road mystery", "coastal noir"))).toEqual([
      "coastal noir",
    ]);
  });

  it("drops a phrase past fifty characters rather than cutting it", () => {
    const long = "a ".repeat(SLOT_MAX);
    expect(usable(tagged(long, "coastal noir"))).toEqual(["coastal noir"]);
  });

  it("drops a phrase a shop publishes a rule against", () => {
    expect(usable(tagged("bestselling coastal noir", "island detective"))).toEqual([
      "island detective",
    ]);
  });

  it("drops a phrase repeating a shelf the book is already on", () => {
    const kept = keepUsable(extractKeywords(tagged("women sleuths in cornwall", "tin mining")) ?? [], {
      ...LISTING,
      categories: ["Fiction / Mystery & Detective / Women Sleuths"],
    });
    expect(kept).toEqual(["tin mining"]);
  });
});

/*
 * A position rather than a behaviour, and the sibling of the tests in
 * `keywords.ts` and `suggest.ts`. Search volume is the figure a writer wants,
 * no shop publishes it, and a plausible number beside a real keyword would be
 * the most believable invented thing in the app. If this goes red the feature
 * has lost what it was built to say.
 */
describe("what it refuses to invent", () => {
  it("forbids a volume, a score and a rank in as many words", () => {
    expect(WORKSHOP_SYSTEM).toMatch(/NEVER give a search volume/);
    for (const word of ["competition score", "difficulty rating", "rank"]) {
      expect(WORKSHOP_SYSTEM).toContain(word);
    }
  });

  it("forbids reciting the words that gate a subcategory", () => {
    expect(WORKSHOP_SYSTEM).toMatch(/NEVER list the specific words/);
  });

  it("carries no field a number could be returned in", () => {
    const found = extractKeywords(tagged("coastal noir"));
    expect(found).toEqual(["coastal noir"]);
    expect(found?.every((p) => typeof p === "string")).toBe(true);
  });
});

describe("what is sent", () => {
  const base = {
    messages: [{ role: "user" as const, content: "help" }],
    listing: LISTING,
  };

  it("names what the shop already indexes, so it can be avoided", () => {
    const prompt = buildWorkshopPrompt(base);
    expect(prompt).toContain("The Salt Road");
    expect(prompt).toContain("Marguerite Hale");
  });

  it("says an empty set of boxes in words rather than as blank lines", () => {
    expect(buildWorkshopPrompt(base)).toContain("All seven boxes are empty");
  });

  it("numbers the boxes that are filled, so “box 4” means something", () => {
    const prompt = buildWorkshopPrompt({
      ...base,
      keywords: ["coastal noir", "", "island detective"],
    });
    expect(prompt).toContain("1. coastal noir");
    expect(prompt).toContain("3. island detective");
  });

  it("says so plainly when there is no description to work from", () => {
    expect(buildWorkshopPrompt(base)).toContain("no description written yet");
  });

  it("cuts a pasted blurb rather than sending a manuscript", () => {
    const prompt = buildWorkshopPrompt({ ...base, blurb: "x".repeat(9000) });
    expect(prompt.length).toBeLessThan(4000);
  });
});
