import { describe, expect, it } from "vitest";
import { paddleStatus } from "./paddle";

/**
 * The one judgement in the Paddle webhook, and the one that has already been
 * wrong in production.
 *
 * A sandbox cancellation on 2026-08-09 proved it: our cancel route wrote
 * `cancelled`, Paddle's `subscription.updated` arrived a second later still
 * saying `active` — correct of Paddle, since the writer had paid to the 9th —
 * and the webhook faithfully undid the cancellation. The account menu then
 * offered to cancel a subscription that was already cancelled and promised a
 * renewal that would never come.
 */

describe("paddleStatus", () => {
  it("reads a scheduled cancellation before the status", () => {
    // The regression. Paddle says active; the subscription is cancelled.
    expect(paddleStatus("active", "cancel")).toBe("cancelled");
    expect(paddleStatus("trialing", "cancel")).toBe("cancelled");
    expect(paddleStatus("past_due", "cancel")).toBe("cancelled");
  });

  it("maps the plain statuses", () => {
    expect(paddleStatus("active", null)).toBe("active");
    expect(paddleStatus("trialing", null)).toBe("active");
    expect(paddleStatus("past_due", null)).toBe("past_due");
    // Paddle spells it with one L.
    expect(paddleStatus("canceled", null)).toBe("cancelled");
  });

  it("treats a pause as cancelled, which is the safe direction", () => {
    // Nothing is being charged, and this table has no fourth word. isPro()
    // then runs it to the paid-up date and stops, rather than serving Pro
    // indefinitely for nothing.
    expect(paddleStatus("paused", null)).toBe("cancelled");
  });

  it("refuses a status it does not know rather than guessing", () => {
    // `status` is a CHECK constraint of three values, and a row that fails it
    // aborts the write for a payment that has already been taken. Null is how
    // the route knows to record the event and leave the row alone.
    expect(paddleStatus("something_new", null)).toBeNull();
    expect(paddleStatus("", null)).toBeNull();
  });

  it("ignores a scheduled change that is not a cancellation", () => {
    // Paddle also schedules pauses and resumes. Only a cancel changes what the
    // writer is entitled to at the end of the period.
    expect(paddleStatus("active", "pause")).toBe("active");
    expect(paddleStatus("active", "resume")).toBe("active");
  });
});
