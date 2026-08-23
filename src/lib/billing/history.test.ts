import { describe, expect, it } from "vitest";
import { hasInvoice, paymentStatus } from "./history";

describe("paymentStatus", () => {
  it("reads Paddle's completed transaction as paid", () => {
    expect(
      paymentStatus({
        provider: "paddle",
        eventType: "transaction.completed",
        statusCode: null,
      }),
    ).toEqual({ label: "Paid", tone: "ok" });
  });

  it("reads PayHere's success code as paid", () => {
    expect(
      paymentStatus({ provider: "payhere", eventType: null, statusCode: 2 }),
    ).toEqual({ label: "Paid", tone: "ok" });
  });

  it("keeps PayHere's refusals apart from its successes", () => {
    expect(
      paymentStatus({ provider: "payhere", eventType: null, statusCode: -2 }).tone,
    ).toBe("stop");
    expect(
      paymentStatus({ provider: "payhere", eventType: null, statusCode: -3 }).label,
    ).toBe("Chargeback");
    expect(
      paymentStatus({ provider: "payhere", eventType: null, statusCode: 0 }).label,
    ).toBe("Pending");
  });

  it("calls a refund a refund rather than a payment", () => {
    expect(
      paymentStatus({
        provider: "paddle",
        eventType: "adjustment.created",
        statusCode: null,
      }),
    ).toEqual({ label: "Refunded", tone: "note" });
  });

  /*
   * The whole reason this module exists. The table printed "Paid" on every row
   * before it, so a status nobody had taught it would have been captioned as a
   * successful payment. An unknown status must never read as a good one.
   */
  it("never reports an unknown status as paid", () => {
    const unknown = paymentStatus({
      provider: "paddle",
      eventType: "transaction.something_new",
      statusCode: null,
    });
    expect(unknown.label).toBe("Something new");
    expect(unknown.tone).toBe("plain");

    const unknownCode = paymentStatus({
      provider: "payhere",
      eventType: null,
      statusCode: 47,
    });
    expect(unknownCode.label).toBe("Code 47");
    expect(unknownCode.tone).toBe("plain");
  });

  it("says nothing rather than something when the row carries no status", () => {
    expect(
      paymentStatus({ provider: "payhere", eventType: null, statusCode: null }).label,
    ).toBe("—");
    expect(
      paymentStatus({ provider: "paddle", eventType: null, statusCode: null }).label,
    ).toBe("—");
  });

  /*
   * `provider` gained its NOT NULL default of 'payhere' in the Paddle
   * migration, so an older row can name a gateway while carrying the other
   * one's vocabulary. Whichever field is actually populated wins.
   */
  it("reads Paddle's words even on a row that predates the provider column", () => {
    expect(
      paymentStatus({
        provider: null,
        eventType: "transaction.completed",
        statusCode: null,
      }),
    ).toEqual({ label: "Paid", tone: "ok" });
  });
});

describe("hasInvoice", () => {
  it("is true only for a completed Paddle transaction", () => {
    expect(
      hasInvoice({ provider: "paddle", eventType: "transaction.completed" }),
    ).toBe(true);
    expect(
      hasInvoice({ provider: "paddle", eventType: "transaction.payment_failed" }),
    ).toBe(false);
    // PayHere emails a receipt and has no document to link to.
    expect(hasInvoice({ provider: "payhere", eventType: null })).toBe(false);
  });
});
