import { describe, expect, it } from "vitest";
import type { Block } from "../export/blocks";
import type { CompTitle } from "./comps";
import {
  candidatesFrom,
  MAX_PICKS,
  openingFrom,
  parseRanking,
  proseFrom,
  restOf,
} from "./rank";

const block = (text: string, kind: Block["kind"] = "paragraph"): Block => ({
  kind,
  depth: 0,
  runs: [{ text }],
});

const comp = (over: Partial<CompTitle> & { key: string }): CompTitle => ({
  title: over.key,
  authors: ["A Writer"],
  subjects: [],
  source: "google",
  ...over,
});

const twenty = Array.from({ length: 20 }, (_, i) => comp({ key: `k${i + 1}` }));
const three = twenty.slice(0, 3);

const picked = (raw: string, books = three) =>
  parseRanking(raw, books).picks.map((p) => p.book.key);

describe("candidatesFrom", () => {
  it("numbers the books from one, which is the model's only handle", () => {
    expect(candidatesFrom(three).map((c) => c.id)).toEqual([1, 2, 3]);
  });

  it("never sends more than it can pay to have read", () => {
    const many = Array.from({ length: 40 }, (_, i) => comp({ key: `k${i}` }));
    expect(candidatesFrom(many)).toHaveLength(20);
  });

  it("cuts a long blurb rather than paying for all of it", () => {
    const [only] = candidatesFrom([
      comp({ key: "k", description: "word ".repeat(400) }),
    ]);
    expect(only.blurb!.length).toBeLessThanOrEqual(401);
  });

  it("leaves the blurb out entirely when the record has none", () => {
    expect(candidatesFrom([comp({ key: "k" })])[0].blurb).toBeUndefined();
  });
});

describe("proseFrom", () => {
  it("keeps the paragraphing, which search.ts throws away", () => {
    expect(proseFrom([block("One."), block("Two.")])).toBe("One.\n\nTwo.");
  });

  it("joins the runs inside a paragraph", () => {
    expect(
      proseFrom([
        { kind: "paragraph", depth: 0, runs: [{ text: "He " }, { text: "ran." }] },
      ]),
    ).toBe("He ran.");
  });

  it("drops images rather than sending a megabyte of base64", () => {
    const image: Block = {
      kind: "image",
      depth: 0,
      src: "data:image/png;base64,AAAA",
      runs: [],
    };
    expect(proseFrom([block("One."), image, block("Two.")])).toBe(
      "One.\n\nTwo.",
    );
  });

  it("drops blocks with nothing in them", () => {
    expect(proseFrom([block("One."), block("   "), block("Two.")])).toBe(
      "One.\n\nTwo.",
    );
  });
});

describe("openingFrom", () => {
  it("sends a short opening whole", () => {
    expect(openingFrom("Once upon a time.", 100)).toBe("Once upon a time.");
  });

  it("cuts at a paragraph rather than mid-sentence", () => {
    const text = `${"a".repeat(60)}\n\n${"b".repeat(60)}`;
    expect(openingFrom(text, 80)).toBe("a".repeat(60));
  });

  it("falls back to a sentence when there is no paragraph break", () => {
    const text = `${"a".repeat(50)}. ${"b".repeat(50)}`;
    expect(openingFrom(text, 80)).toBe("a".repeat(50));
  });

  it("cuts hard rather than throwing away most of the sample", () => {
    // The only boundary is at the very start, so honouring it would send four
    // characters instead of eighty.
    const text = `abc\n\n${"d".repeat(200)}`;
    expect(openingFrom(text, 80)).toHaveLength(80);
  });
});

describe("parseRanking", () => {
  it("reads the ordinary answer", () => {
    const raw = '{"picks":[{"id":2,"reason":"Same quiet register."}]}';
    const { picks } = parseRanking(raw, three);
    expect(picks).toHaveLength(1);
    expect(picks[0].book.key).toBe("k2");
    expect(picks[0].reason).toBe("Same quiet register.");
  });

  it("keeps the model's order, which is the ranking", () => {
    const raw =
      '{"picks":[{"id":3,"reason":"a"},{"id":1,"reason":"b"},{"id":2,"reason":"c"}]}';
    expect(picked(raw)).toEqual(["k3", "k1", "k2"]);
  });

  it("digs the JSON out of a preamble", () => {
    const raw = 'Here is the ranking:\n{"picks":[{"id":1,"reason":"Close."}]}';
    expect(picked(raw)).toEqual(["k1"]);
  });

  it("digs it out of a code fence", () => {
    const raw = '```json\n{"picks":[{"id":1,"reason":"Close."}]}\n```';
    expect(picked(raw)).toEqual(["k1"]);
  });

  it("accepts a bare array, which models send about a third of the time", () => {
    expect(picked('[{"id":2,"reason":"Close."}]')).toEqual(["k2"]);
  });

  // The one that matters most: a model asked about books will invent one.
  it("drops an id nobody offered rather than guessing at it", () => {
    const raw =
      '{"picks":[{"id":1,"reason":"Real."},{"id":99,"reason":"Invented."}]}';
    expect(picked(raw)).toEqual(["k1"]);
  });

  it("drops a zero or a negative id", () => {
    expect(picked('[{"id":0,"reason":"x"},{"id":-1,"reason":"y"}]')).toEqual([]);
  });

  it("names each book once", () => {
    const raw = '[{"id":1,"reason":"a"},{"id":1,"reason":"again"}]';
    expect(picked(raw)).toEqual(["k1"]);
  });

  it("drops a pick with no reason, rather than showing a bare assertion", () => {
    const raw = '[{"id":1,"reason":"  "},{"id":2,"reason":"Because."}]';
    expect(picked(raw)).toEqual(["k2"]);
  });

  it("never returns more than a listing has room for", () => {
    const raw = JSON.stringify({
      picks: twenty.map((_, i) => ({ id: i + 1, reason: "Close." })),
    });
    expect(parseRanking(raw, twenty).picks).toHaveLength(MAX_PICKS);
  });

  it("cuts a runaway reason instead of letting it own the page", () => {
    const raw = JSON.stringify({
      picks: [{ id: 1, reason: "word ".repeat(200) }],
    });
    expect(parseRanking(raw, three).picks[0].reason.length).toBeLessThanOrEqual(
      301,
    );
  });

  it("survives an answer that is not JSON at all", () => {
    expect(parseRanking("I could not decide.", three)).toEqual({
      picks: [],
      pattern: null,
    });
    expect(parseRanking("", three)).toEqual({ picks: [], pattern: null });
  });

  it("survives JSON of the wrong shape", () => {
    expect(parseRanking('{"answer":"none"}', three).picks).toEqual([]);
    expect(parseRanking('[1,2,3]', three).picks).toEqual([]);
  });

  it("reads the pattern when there is one, and null when there is not", () => {
    expect(
      parseRanking('{"picks":[],"pattern":"All open on a death."}', three)
        .pattern,
    ).toBe("All open on a death.");
    expect(parseRanking('{"picks":[]}', three).pattern).toBeNull();
    expect(parseRanking('{"picks":[],"pattern":"  "}', three).pattern).toBeNull();
  });

  // A position rather than a behaviour: if a score ever appears here the
  // feature has lost the thing it was built to say. See the house rules.
  it("carries no score, no grade and no percentage", () => {
    const raw =
      '{"picks":[{"id":1,"reason":"Close.","score":92,"confidence":0.8}]}';
    expect(Object.keys(parseRanking(raw, three).picks[0]).sort()).toEqual([
      "book",
      "reason",
    ]);
  });
});

describe("restOf", () => {
  it("keeps everything that was not picked, in the order it arrived", () => {
    const { picks } = parseRanking('[{"id":2,"reason":"Close."}]', three);
    expect(restOf(three, picks).map((b) => b.key)).toEqual(["k1", "k3"]);
  });

  it("is the whole list when nothing was picked", () => {
    expect(restOf(three, [])).toHaveLength(3);
  });
});
