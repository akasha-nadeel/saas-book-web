import { readFileSync, readdirSync } from "node:fs";
import { expect, it } from "vitest";
import {
  LAUNCH_LIMITS,
  amazonLocked,
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
 * **Amazon's data is shut to Free and to Pro, and to nobody while unknown.**
 *
 * The same three parts as `onFreePlan`, read off the tier rather than the
 * paid flag, because Pro is paid and still does not get it (2026-10-12).
 */
it("shuts Amazon's data below Pro Plus, never while unknown or with no gateway", () => {
  const known = { loading: false, billing: true };
  expect(amazonLocked({ ...known, tier: "free" })).toBe(true);
  expect(amazonLocked({ ...known, tier: "pro" })).toBe(true);
  expect(amazonLocked({ ...known, tier: "plus" })).toBe(false);
  expect(amazonLocked({ ...known, loading: true, tier: null })).toBe(false);
  expect(amazonLocked({ loading: false, billing: false, tier: null })).toBe(false);
});

/**
 * **The free book count is stated twice and they must agree**:
 * `TIER_LIMITS.free.books`, which every browser gate reads through
 * `bookLimitFor`, and the trigger in the newest migration that writes it,
 * which is the one that actually refuses. SQL cannot import TypeScript, so the
 * test reads the migrations — the browser offering a book Postgres then
 * refuses is the drift this catches. (Free went unlimited on 2026-10-13 in
 * code that never shipped; `20261015000000_free_three_books_again.sql` put the
 * trigger back.) It cannot know what the live database runs, so check that
 * too before deploying.
 */
it("holds three books on the free plan, in TypeScript and in SQL", async () => {
  const { TIER_LIMITS, PAID_TIERS } = await import("@/lib/billing/tiers");
  expect(TIER_LIMITS.free.books).toBe(3);
  for (const tier of PAID_TIERS) expect(TIER_LIMITS[tier].books).toBeNull();

  const dir = "supabase/migrations";
  const latest = readdirSync(dir)
    .filter((f) => f.endsWith(".sql"))
    .sort()
    .map((f) => readFileSync(`${dir}/${f}`, "utf8"))
    .filter((sql) => sql.includes("books_launch_free_limit"))
    .at(-1);
  expect(latest).toMatch(/create trigger books_launch_free_limit/);
  const limit = latest?.match(/if v_count >= (\d+) then/);
  expect(limit?.[1]).toBe(String(TIER_LIMITS.free.books));
});
