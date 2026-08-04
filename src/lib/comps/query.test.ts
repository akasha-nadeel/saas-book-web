import { describe, expect, it } from "vitest";
import {
  buildPrompt,
  looksPlain,
  MAX_QUERY,
  parseQuery,
  SYSTEM,
} from "./query";

describe("parseQuery", () => {
  it("takes a clean query line", () => {
    expect(parseQuery('subject:"Young adult" subject:"Humorous fiction"')).toBe(
      'subject:"Young adult" subject:"Humorous fiction"',
    );
  });

  it("keeps a quoted subject whole", () => {
    // Splitting on the space inside the quotes leaves a bare `fiction"` term,
    // which matches most books ever written.
    expect(parseQuery('subject:"Historical fiction"')).toBe(
      'subject:"Historical fiction"',
    );
  });

  it("unwraps a code fence", () => {
    expect(parseQuery('```\nsubject:"Fantasy"\n```')).toBe('subject:"Fantasy"');
  });

  it("unwraps a fence with a language tag", () => {
    expect(parseQuery('```text\nsubject:"Fantasy"\n```')).toBe(
      'subject:"Fantasy"',
    );
  });

  it("drops a preamble sitting on its own line", () => {
    expect(parseQuery('Here is the query:\nsubject:"Romance"')).toBe(
      'subject:"Romance"',
    );
  });

  it("drops a preamble inline before the query", () => {
    expect(parseQuery('Here is the query: subject:"Romance"')).toBe(
      'subject:"Romance"',
    );
  });

  it("does not mistake a field prefix for a preamble", () => {
    // `subject:` is also text before a colon. The first version of this parser
    // used that loose rule and ate the one term that mattered.
    expect(parseQuery('subject:"Mystery" small town')).toBe(
      'subject:"Mystery" small town',
    );
  });

  it("drops a prefix neither catalogue takes", () => {
    // Open Library answers an unknown prefix with zero results rather than an
    // error, so one stray term empties the shelf with nothing to explain it.
    expect(parseQuery('subject:"Fantasy" isbn:9780000000000')).toBe(
      'subject:"Fantasy"',
    );
  });

  it("keeps bare words", () => {
    expect(parseQuery("boarding school found family")).toBe(
      "boarding school found family",
    );
  });

  it("returns null for an empty reply", () => {
    expect(parseQuery("")).toBeNull();
    expect(parseQuery("   ")).toBeNull();
  });

  it("returns null when every term was refused", () => {
    expect(parseQuery("isbn:123 lccn:456")).toBeNull();
  });

  it("returns null for a non-string", () => {
    expect(parseQuery(null as unknown as string)).toBeNull();
    expect(parseQuery(42 as unknown as string)).toBeNull();
  });

  it("caps the length", () => {
    const long = Array.from({ length: 80 }, (_, i) => `word${i}`).join(" ");
    expect((parseQuery(long) ?? "").length).toBeLessThanOrEqual(MAX_QUERY);
  });
});

describe("looksPlain", () => {
  it("is true for a writer's sentence", () => {
    expect(looksPlain("funny people smile every time")).toBe(true);
  });

  it("is false for a query that already has fields", () => {
    // The shelf chips and the seeded search send exactly this, and rewriting
    // it would spend a model call to change nothing.
    expect(looksPlain('subject:"Young adult"')).toBe(false);
  });
});

describe("the prompt", () => {
  it("carries the writer's words", () => {
    expect(buildPrompt({ words: "a girl finds a door" })).toContain(
      "a girl finds a door",
    );
  });

  it("names the genre when there is one", () => {
    expect(buildPrompt({ words: "x", genre: "Fantasy" })).toContain("Fantasy");
  });

  it("leaves Other out, which is not a shelf", () => {
    expect(buildPrompt({ words: "x", genre: "Other" })).not.toContain("Other");
  });

  it("forbids quoting the writer's own sentence", () => {
    // No catalogue holds a phrase from an unpublished manuscript, so quoting
    // it guarantees the empty result this feature exists to prevent.
    expect(SYSTEM).toMatch(/never quote a phrase from the writer/i);
  });

  it("asks for no score, rank or volume", () => {
    // The cluster-wide rule: nothing here may invent a measurement.
    expect(SYSTEM).not.toMatch(/\bscore\b|bestseller rank|search volume/i);
  });
});

describe("parseQuery against real shelves", () => {
  const known = new Set(["cozy mystery", "fantasy", "romance"]);

  // The measured failure: a shelf the model made up by merging two genres.
  // It matches nothing, so the plain words carry the search and the screen
  // fills with the wrong books while looking entirely successful.
  it("drops a subject no catalogue actually has", () => {
    expect(parseQuery('subject:"Fantasy mystery" librarian', known)).toBe(
      "librarian",
    );
  });

  it("keeps a subject that is a real shelf", () => {
    expect(parseQuery('subject:"Cozy mystery" librarian', known)).toBe(
      'subject:"Cozy mystery" librarian',
    );
  });

  it("matches case-insensitively, as the catalogue does", () => {
    expect(parseQuery('subject:"FANTASY"', known)).toBe('subject:"FANTASY"');
  });

  it("returns null when the invented shelf was the whole query", () => {
    expect(parseQuery('subject:"Fantasy mystery"', known)).toBeNull();
  });

  // Without a list nothing is checked, which is what the parser's other
  // callers and every existing test rely on.
  it("checks nothing when no list is given", () => {
    expect(parseQuery('subject:"Fantasy mystery"')).toBe(
      'subject:"Fantasy mystery"',
    );
  });

  it("leaves title and author terms alone — they are not shelves", () => {
    expect(parseQuery('intitle:"The Silent Patient"', known)).toBe(
      'intitle:"The Silent Patient"',
    );
  });
});

describe("stray formatting", () => {
  // A model asked for one line of syntax reaches for inline code. The closing
  // backtick survived and was searched for literally.
  it("strips backticks left on a term", () => {
    expect(parseQuery('subject:"Portal fantasy"`')).toBe(
      'subject:"Portal fantasy"',
    );
  });

  it("strips backticks wrapping the whole line", () => {
    expect(parseQuery('`subject:"Fantasy" quest`')).toBe(
      'subject:"Fantasy" quest',
    );
  });
});

describe("prose leaking in beside a real term", () => {
  const known = new Set(["haunted houses", "fantasy"]);

  // Measured: a valid shelf with a question mark and a stray clause after it.
  // Salvaging the shelf and searching the rest as words is how a wrong result
  // arrives looking like a right one.
  it("refuses a reply that is part query, part sentence", () => {
    expect(parseQuery('subject:"Haunted houses"? Or haunted', known)).toBeNull();
  });

  it("refuses an exclamation or a semicolon", () => {
    expect(parseQuery('subject:"Fantasy"! quest', known)).toBeNull();
    expect(parseQuery('subject:"Fantasy"; quest', known)).toBeNull();
  });

  // Punctuation *inside* a quoted shelf is the catalogue's own, not prose.
  it("allows punctuation inside a quoted subject", () => {
    const ok = new Set(['children"s stories', "who? me"]);
    expect(parseQuery('subject:"who? me"', ok)).toBe('subject:"who? me"');
  });
});
