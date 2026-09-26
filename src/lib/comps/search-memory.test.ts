import { describe, it, expect } from "vitest";
import { remember, recall, forget } from "./search-memory";

/**
 * A cache this small is mostly tested by the screens that use it, so what is
 * here is the handful of properties those screens rely on being true: that a
 * value comes back as it went in, that an absent one is `null` rather than a
 * throw, and that two tools sharing the module cannot read each other.
 */

describe("search-memory", () => {
  it("gives back what was kept", () => {
    remember("a-tool", { query: "cozy mystery", found: 12 });
    expect(recall<{ query: string; found: number }>("a-tool")).toEqual({
      query: "cozy mystery",
      found: 12,
    });
  });

  /*
   * The screens read this in a lazy `useState` initialiser and write
   * `recall(…) ?? somethingEmpty`, so the absent case has to be a value rather
   * than a throw — and `null` rather than `undefined`, so there is only one
   * kind of absence to write against.
   */
  it("answers null for a tool that has not searched", () => {
    expect(recall("never-used")).toBe(null);
  });

  it("keeps one tool's snapshot out of another's", () => {
    remember("title-check", "a title");
    remember("price-check", "a price");
    expect(recall("title-check")).toBe("a title");
    expect(recall("price-check")).toBe("a price");
  });

  it("replaces rather than accumulating, so it cannot grow", () => {
    remember("one-key", "first");
    remember("one-key", "second");
    expect(recall("one-key")).toBe("second");
  });

  it("forgets on request, and forgetting twice is not an error", () => {
    remember("temporary", "here");
    forget("temporary");
    expect(recall("temporary")).toBe(null);
    expect(() => forget("temporary")).not.toThrow();
  });

  /*
   * The reason this module exists rather than the store: nothing it holds
   * should outlive the tab. If a future edit makes it write to disk, this is
   * the test that should stop being true.
   */
  it("writes nothing to storage", () => {
    const before = localStorage.length;
    remember("storage-check", { a: 1 });
    recall("storage-check");
    expect(localStorage.length).toBe(before);
  });
});
