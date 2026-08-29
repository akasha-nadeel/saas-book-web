import { expect, it } from "vitest";
import { LAUNCH_LIMITS, exportAllowed } from "@/lib/launch";

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
