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
