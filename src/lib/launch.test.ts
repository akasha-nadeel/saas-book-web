import { expect, it } from "vitest";
import {
  LAUNCH_LIMITS,
  aiChatClosed,
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

/**
 * **The balance is the gate, not the plan, and this is what says so.**
 *
 * It asked about the tier until 2026-09-04 — the right question while the
 * assistant was what Writer and Studio bought. Credits make it the wrong one in
 * both directions at once: a Free account holding bought credits is entitled to
 * spend them, and a Writer who has spent the month is not entitled to more. A
 * gate written against the tier gets one of those wrong whichever way it is
 * written, and `chat-panel.tsx` is the one call site — nothing else in the tree
 * would notice it going back.
 */
it("shuts the assistant only when there is nothing left to spend", () => {
  const known = { loading: false, billing: true };
  expect(aiChatClosed({ ...known, credits: 0 })).toBe(true);
  expect(aiChatClosed({ ...known, credits: 10 })).toBe(false);
});

/**
 * **A free account holding credits may spend them**, which is the case the tier
 * test could not express: there is no tier here at all, only a balance.
 */
it("opens on a balance regardless of where it came from", () => {
  expect(aiChatClosed({ loading: false, billing: true, credits: 400 })).toBe(
    false,
  );
});

/** The same loading-window rule as `onFreePlan`, and for the same reason. */
it("refuses no assistant while the balance is still unknown", () => {
  expect(aiChatClosed({ loading: true, billing: true })).toBe(false);
  expect(aiChatClosed({ loading: true, billing: true, credits: 0 })).toBe(false);
  expect(aiChatClosed({ loading: false, billing: true })).toBe(false);
  expect(aiChatClosed({ loading: false, billing: true, credits: undefined })).toBe(
    false,
  );
});

/**
 * Configure no gateway and there are no plans, so nothing is held back — and
 * `null` says the same thing a second way, for the self-hosted copy running on
 * its owner's own API key. Neither may read as an empty balance.
 */
it("leaves the assistant open where nothing is metered", () => {
  expect(aiChatClosed({ loading: false, billing: false, credits: 0 })).toBe(false);
  expect(aiChatClosed({ loading: false, billing: true, credits: null })).toBe(
    false,
  );
});
