import { describe, expect, it } from "vitest";
import { SLOTS, SLOT_MAX } from "@/lib/keywords";
import { buildPrompt, suggestKeywords } from "./suggest";

const LISTING = {
  title: "The Salt Road",
  author: "Marguerite Hale",
};

/** What a well-behaved model sends back. */
const ok = (...keywords: string[]) => JSON.stringify({ keywords });

describe("reading the reply", () => {
  it("takes the phrases out of the shape it asked for", () => {
    expect(suggestKeywords(ok("coastal noir", "island detective"), LISTING)).toEqual([
      "coastal noir",
      "island detective",
    ]);
  });

  /*
   * Generated text is hostile input, and each of these is a shape a model has
   * actually produced when asked for JSON. `rank.ts` carries the same list for
   * the same reason.
   */
  it("survives a preamble before the JSON", () => {
    const reply = `Sure! Here are some keyword ideas:\n${ok("coastal noir")}`;
    expect(suggestKeywords(reply, LISTING)).toEqual(["coastal noir"]);
  });

  it("survives a code fence", () => {
    expect(
      suggestKeywords("```json\n" + ok("coastal noir") + "\n```", LISTING),
    ).toEqual(["coastal noir"]);
  });

  it("survives a bare array rather than the object", () => {
    expect(suggestKeywords('["coastal noir","island detective"]', LISTING)).toEqual([
      "coastal noir",
      "island detective",
    ]);
  });

  /*
   * The one that needs the object tried before the array: scanning a bare
   * array for `{` finds the first *element's* brace and parses one item as the
   * whole reply.
   */
  it("reads a bare array of objects as nothing rather than as one item", () => {
    expect(suggestKeywords('[{"phrase":"coastal noir"}]', LISTING)).toEqual([]);
  });

  it("strips numbering and quotes a model wrapped a phrase in", () => {
    expect(suggestKeywords(ok('1. "coastal noir"'), LISTING)).toEqual([
      "coastal noir",
    ]);
  });

  it("answers nothing at all for junk rather than throwing", () => {
    for (const junk of ["", "I cannot help with that.", "{", "null", "42"]) {
      expect(suggestKeywords(junk, LISTING)).toEqual([]);
    }
  });
});

describe("the checker is the filter", () => {
  /*
   * **Dropped, never truncated.** A phrase cut at fifty characters is a
   * different phrase, and the writer would be shown words nobody wrote.
   */
  it("drops a phrase past the field limit instead of cutting it", () => {
    const long = "a".repeat(SLOT_MAX + 1);
    expect(suggestKeywords(ok(long, "coastal noir"), LISTING)).toEqual([
      "coastal noir",
    ]);
  });

  it("drops a phrase repeating what the listing already indexes", () => {
    // "salt" and "road" are the title's, so the shop indexes them anyway.
    expect(suggestKeywords(ok("the salt road mystery", "coastal noir"), LISTING)).toEqual(
      ["coastal noir"],
    );
  });

  it("drops a phrase carrying a term the shops publish a rule against", () => {
    expect(
      suggestKeywords(ok("bestselling coastal noir", "island detective"), LISTING),
    ).toEqual(["island detective"]);
  });

  it("drops a word already spent in an earlier suggestion", () => {
    // The second would spend "noir" twice, which costs a slot for nothing.
    expect(suggestKeywords(ok("coastal noir", "noir thriller"), LISTING)).toEqual([
      "coastal noir",
    ]);
  });

  it("collapses duplicates however they were capitalised", () => {
    expect(suggestKeywords(ok("coastal noir", "Coastal Noir"), LISTING)).toEqual([
      "coastal noir",
    ]);
  });

  it("never returns more than the boxes can hold", () => {
    // Nine distinct phrases sharing no words between them.
    const many = ok(
      "coastal noir",
      "island detective",
      "smuggling mystery",
      "windswept village",
      "amateur sleuth",
      "cold case",
      "harbour town",
      "slow burn",
      "unreliable narrator",
    );
    expect(suggestKeywords(many, LISTING).length).toBe(SLOTS);
  });
});

/*
 * **The one not to "fix".** Everything about this feature is honest only while
 * it reports words and nothing else. A score, a volume or a rank beside a real
 * keyword would be the most believable invented number in the app — a reader
 * has no way to tell it from a measurement, and the figure it imitates is one
 * no shop publishes. The sibling of this test lives in `keywords.test.ts`.
 */
describe("the shape carries no invented number", () => {
  it("returns plain strings, with nowhere to put a score", () => {
    const out = suggestKeywords(ok("coastal noir", "island detective"), LISTING);
    for (const item of out) expect(typeof item).toBe("string");
  });

  it("ignores a score the model volunteered", () => {
    const reply = JSON.stringify({
      keywords: [{ phrase: "coastal noir", volume: 4200, score: 87 }],
    });
    expect(suggestKeywords(reply, LISTING)).toEqual([]);
  });
});

describe("what is sent", () => {
  /*
   * The manuscript never goes. This test is the reminder attached to that: if
   * a field is added to `SuggestInput` and to the prompt, the privacy page has
   * to name the route in the same commit.
   */
  it("carries the listing form's own fields and nothing else", () => {
    const prompt = buildPrompt({
      blurb: "A body washes up on the causeway.",
      genre: "Mystery",
      categories: ["Cozy Mystery", "Amateur Sleuth"],
      listing: LISTING,
    });

    expect(prompt).toContain("Mystery");
    expect(prompt).toContain("Cozy Mystery");
    expect(prompt).toContain("A body washes up on the causeway.");
    // The names are given so the model can steer around them.
    expect(prompt).toContain("The Salt Road");
    expect(prompt).toContain("do not repeat");
  });

  it("asks for something useful even with only a genre", () => {
    const prompt = buildPrompt({ genre: "Mystery", listing: {} });
    expect(prompt).toContain("Mystery");
    expect(prompt).toContain("keyword phrases");
  });

  it("cuts a pasted manuscript down to a description's length", () => {
    const prompt = buildPrompt({ blurb: "word ".repeat(4000), listing: {} });
    expect(prompt.length).toBeLessThan(3000);
  });
});
