import { describe, expect, it } from "vitest";
import { SLOT_MAX } from "@/lib/keywords";
import { KEYWORD_GUIDE, SOURCES } from "./guide";

const entries = KEYWORD_GUIDE.flatMap((topic) => topic.entries);
const prose = entries
  .flatMap((entry) => [entry.q, ...entry.a, ...(entry.steps ?? [])])
  .join("\n")
  .toLowerCase();

describe("the guide", () => {
  it("has a topic id for every topic, and no two the same", () => {
    const ids = KEYWORD_GUIDE.map((t) => t.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("gives every topic something to say", () => {
    for (const topic of KEYWORD_GUIDE) {
      expect(topic.entries.length).toBeGreaterThan(0);
      expect(topic.lead).toBeTruthy();
      for (const entry of topic.entries) {
        expect(entry.a.length).toBeGreaterThan(0);
      }
    }
  });

  it("quotes the character limit from the form rather than typing it again", () => {
    expect(prose).toContain(`${SLOT_MAX} characters`);
  });

  /*
   * **The whole reason this file exists.** The model is the part most likely
   * not to be there — no key on a self-hosted copy, an allowance spent, a
   * gateway having an afternoon — and a guide that assumed it would answer
   * would fail at exactly the moment it is needed. So there has to be a method
   * somebody can follow with nothing but the boxes.
   */
  it("carries a method that needs nothing but the writer", () => {
    const method = entries.find((entry) => entry.steps && entry.steps.length > 0);
    expect(method).toBeDefined();
    expect(method!.steps!.length).toBeGreaterThanOrEqual(4);
  });

  it("says the checking half works with no account and no connection", () => {
    expect(prose).toContain("no connection");
  });

  it("links to the shop's own pages for every claim it makes", () => {
    expect(SOURCES.length).toBeGreaterThan(0);
    for (const source of SOURCES) {
      expect(source.href.startsWith("https://kdp.amazon.com/")).toBe(true);
      expect(source.label).toBeTruthy();
    }
  });
});

/*
 * A position rather than a behaviour, and the sibling of the tests in
 * `keywords.ts`, `suggest.ts` and `workshop.ts`. A guide is where an invented
 * number would be *most* believable, because it reads as documentation rather
 * than as a guess. There is no honest source for one, so there is none here.
 */
describe("what it refuses to invent", () => {
  it("quotes no search volume, competition score or rank", () => {
    for (const claim of [
      "search volume",
      "competition score",
      "difficulty score",
      "keyword strength",
    ]) {
      // Named only where it is being refused, never as a figure.
      expect(prose.includes(`${claim} of`)).toBe(false);
      expect(prose).not.toMatch(new RegExp(`\\d+\\s*${claim}`));
    }
  });

  it("does not print a list of the words that gate a subcategory", () => {
    const gated = KEYWORD_GUIDE.find((t) => t.id === "categories")!;
    const said = gated.entries.flatMap((e) => e.a).join(" ");
    // One worked example, named as Amazon's own, and then the pointer. A list
    // of our own would go stale silently and be read as ours.
    expect(said).toContain("publishes");
    expect(said).toContain("do not ship a copy");
  });
});
