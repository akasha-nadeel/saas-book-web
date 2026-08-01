import { describe, expect, it } from "vitest";
import { PHASES, STEPS, progressOf, roadmapFor } from "./roadmap";
import type { Book } from "./library-store";

const chapter = (words: number) => ({ id: "c1", title: "One", words });

const book = (over: Partial<Book> = {}): Book =>
  ({
    id: "b1",
    title: "A Book",
    chapters: [],
    createdAt: 0,
    lastOpenedAt: 0,
    ...over,
  }) as Book;

const stateOf = (id: string, b: Book, ticked: string[] = []) =>
  roadmapFor(b, ticked).find((s) => s.id === id)!;

describe("the list itself", () => {
  it("gives every step a unique id", () => {
    expect(new Set(STEPS.map((s) => s.id)).size).toBe(STEPS.length);
  });

  it("puts every step in a phase that exists", () => {
    const phases = new Set(PHASES.map((p) => p.id));
    for (const step of STEPS) expect(phases.has(step.phase)).toBe(true);
  });

  it("keeps the steps grouped, so the list reads in order", () => {
    const order = PHASES.map((p) => p.id);
    const seen = STEPS.map((s) => order.indexOf(s.phase));
    expect(seen).toEqual([...seen].sort((a, b) => a - b));
  });

  /**
   * The load-bearing fact in the whole feature. Three separate research
   * threads describe writers finding out about ARC readers *after* publishing
   * and then spending months chasing reviews for a book already out. If this
   * ever moves, the list has lost the thing it was built to say.
   */
  it("puts lining up ARC readers before uploading", () => {
    const arc = STEPS.findIndex((s) => s.id === "arc");
    const upload = STEPS.findIndex((s) => s.id === "upload");
    expect(arc).toBeGreaterThan(-1);
    expect(arc).toBeLessThan(upload);
  });
});

describe("roadmapFor", () => {
  it("works out that the draft is started from the words in it", () => {
    expect(stateOf("start", book()).done).toBe(false);
    expect(
      stateOf("start", book({ chapters: [chapter(12)] }))
        .done,
    ).toBe(true);
  });

  it("works out the blurb and the categories from the book", () => {
    const filled = book({
      publishing: { description: "A blurb", subjects: ["Fantasy"] },
    } as Partial<Book>);
    expect(stateOf("blurb", filled).done).toBe(true);
    expect(stateOf("categories", filled).done).toBe(true);
  });

  it("does not count an empty blurb as written", () => {
    const blank = book({ publishing: { description: "   " } } as Partial<Book>);
    expect(stateOf("blurb", blank).done).toBe(false);
  });

  it("takes a hand tick for a step it cannot work out", () => {
    expect(stateOf("draft", book(), ["draft"]).done).toBe(true);
    expect(stateOf("draft", book()).done).toBe(false);
  });

  /**
   * Detected beats ticked. A checklist that can be lied to is one that will
   * be, usually by accident — and then it is worse than not existing.
   */
  it("ignores a hand tick on a step that can work itself out", () => {
    expect(stateOf("blurb", book(), ["blurb"]).done).toBe(false);
  });

  it("says which steps it worked out and which it was told", () => {
    expect(stateOf("blurb", book()).automatic).toBe(true);
    expect(stateOf("draft", book()).automatic).toBe(false);
  });

  /**
   * Not detected on purpose. A generated placeholder cover is attached like
   * any other, and ticking off the most expensive step in the list on the
   * strength of a gradient would be the worst kind of wrong.
   */
  it("never works out that a cover has been made", () => {
    expect(stateOf("cover", book()).automatic).toBe(false);
  });
});

describe("progressOf", () => {
  it("counts what is done and points at the next thing", () => {
    const steps = roadmapFor(book(), []);
    const progress = progressOf(steps);
    expect(progress.total).toBe(STEPS.length);
    expect(progress.done).toBe(0);
    expect(progress.next?.id).toBe("start");
  });

  it("moves on once a step is done", () => {
    const started = book({ chapters: [chapter(12)] });
    expect(progressOf(roadmapFor(started, [])).next?.id).toBe("target");
  });

  it("has nothing next when everything is done", () => {
    const all = STEPS.map((s) => s.id);
    const finished = roadmapFor(book(), all).map((s) => ({
      ...s,
      done: true,
    }));
    expect(progressOf(finished).next).toBeNull();
  });
});
