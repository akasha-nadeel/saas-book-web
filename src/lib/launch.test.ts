import { expect, it } from "vitest";
import {
  LAUNCH_LIMITS,
  assistantWriteAllowed,
  exportAllowed,
  onFreePlan,
  trashedBookClosed,
} from "@/lib/launch";

/**
 * **Export is not gated on any plan, and this is the test that says so.**
 *
 * The launch MVP charged for EPUB and PDF for a while. It was the wrong thing
 * to charge for — a writer has to be able to take the book and go, and the one
 * tool a competitor review singled out for locking export was marked down for
 * exactly that. The decision is recorded in `launch.ts`, but a decision written
 * only in a comment is one array edit away from being reversed by accident.
 *
 * Nothing else protects it: there is no migration, no type and no other test
 * that would notice `freeExports` narrowing again.
 */
it("puts every export format on the free plan", () => {
  for (const format of LAUNCH_LIMITS.proExports) {
    expect(exportAllowed(format, false)).toBe(true);
    expect(exportAllowed(format, true)).toBe(true);
  }
  expect([...LAUNCH_LIMITS.freeExports]).toEqual([
    ...LAUNCH_LIMITS.proExports,
  ]);
});

/**
 * **The assistant writing into the chapter is Pro, and only Pro.**
 *
 * The mirror of the test above, and here for the same reason: the decision is
 * a boolean in a frozen object, and nothing else in the tree would notice it
 * being flipped. The free plan keeps the assistant it always had — it reads the
 * chapter and offers text — and buying Pro is what makes that text applicable.
 */
it("keeps writing into the chapter on the paid plan", () => {
  expect(assistantWriteAllowed(true)).toBe(true);
  expect(assistantWriteAllowed(false)).toBe(false);
  expect(LAUNCH_LIMITS.freeAssistantWrite).toBe(false);
});

it("still refuses a format that is not an export at all", () => {
  // The gate answers on the format, not on the plan, so a typo upstream is not
  // quietly waved through as "free".
  expect(exportAllowed("rtf", false)).toBe(false);
  expect(exportAllowed("rtf", true)).toBe(false);
  expect(exportAllowed("", true)).toBe(false);
});

/**
 * **The free plan's closed door, and the window where it must stay open.**
 *
 * `usePlan()` starts at UNKNOWN — `loading: true, pro: false` — so for the
 * width of one request a Pro reader is shaped exactly like a free one. The
 * shelf has already shipped that bug once, in the restore gate, where a writer
 * with unlimited books was told there was no room. Two call sites read this
 * rule now (the jacket's press and the route gate under `/book/[bookId]`), and
 * nothing else would notice the `loading` half going missing again.
 */
const FREE = { loading: false, billing: true, pro: false };

it("keeps a trashed book shut on the free plan", () => {
  expect(trashedBookClosed({ trashedAt: Date.now() }, FREE)).toBe(true);
});

it("opens a trashed book for Pro, and every book that is not in the trash", () => {
  expect(trashedBookClosed({ trashedAt: Date.now() }, { ...FREE, pro: true })).toBe(
    false,
  );
  expect(trashedBookClosed({}, FREE)).toBe(false);
  expect(trashedBookClosed({ trashedAt: 0 }, FREE)).toBe(false);
  expect(trashedBookClosed(null, FREE)).toBe(false);
});

it("refuses nothing while the plan is still unknown", () => {
  expect(trashedBookClosed({ trashedAt: Date.now() }, { ...FREE, loading: true })).toBe(
    false,
  );
  expect(onFreePlan({ ...FREE, loading: true })).toBe(false);
});

it("holds nothing back where no gateway is configured", () => {
  // Configure neither Paddle nor PayHere and there are no plans at all — so
  // there is no free plan to be on, and the trash is the writer's own.
  expect(onFreePlan({ ...FREE, billing: false })).toBe(false);
  expect(
    trashedBookClosed({ trashedAt: Date.now() }, { ...FREE, billing: false }),
  ).toBe(false);
});
