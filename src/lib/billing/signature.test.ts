import { describe, expect, it } from "vitest";
import {
  checkoutHash,
  notificationSignature,
  verifyNotification,
} from "./signature";

/**
 * The fixtures below were computed once, by hand, from PayHere's published
 * formula. They are not a second implementation of MD5 — that would only test
 * Node against itself. What they pin down is everything around it, which is
 * where the mistakes actually are: the order the fields are concatenated in,
 * the fact that the secret is hashed and upper-cased *before* being appended,
 * and that the result is upper-cased too.
 *
 * A wrong hash is not a subtle bug in production — PayHere refuses the whole
 * checkout — but it fails at the gateway with a message that says nothing about
 * which of those three things was wrong.
 */

const MERCHANT_ID = "1221149";
const MERCHANT_SECRET = "MySecret123";
const ORDER_ID = "OC-TEST-1";

describe("checkoutHash", () => {
  it("matches PayHere's formula", () => {
    expect(
      checkoutHash({
        merchantId: MERCHANT_ID,
        orderId: ORDER_ID,
        amount: "6.56",
        currency: "USD",
        merchantSecret: MERCHANT_SECRET,
      }),
    ).toBe("E3E29510D07DF05A60F8A6D06BB02708");
  });

  it("is upper-case hex", () => {
    const hash = checkoutHash({
      merchantId: MERCHANT_ID,
      orderId: ORDER_ID,
      amount: "6.56",
      currency: "USD",
      merchantSecret: MERCHANT_SECRET,
    });

    expect(hash).toMatch(/^[0-9A-F]{32}$/);
  });

  it("changes with the amount", () => {
    const base = {
      merchantId: MERCHANT_ID,
      orderId: ORDER_ID,
      currency: "USD",
      merchantSecret: MERCHANT_SECRET,
    };

    expect(checkoutHash({ ...base, amount: "6.56" })).not.toBe(
      checkoutHash({ ...base, amount: "6.57" }),
    );
  });

  it("changes with the secret", () => {
    const base = {
      merchantId: MERCHANT_ID,
      orderId: ORDER_ID,
      amount: "6.56",
      currency: "USD",
    };

    expect(checkoutHash({ ...base, merchantSecret: "a" })).not.toBe(
      checkoutHash({ ...base, merchantSecret: "b" }),
    );
  });

  // "6.56" and "6.560" are the same money and a different hash. The amount is
  // formatted once, by payhereAmount(), and the same string is what gets sent.
  it("treats the amount as a string, not a number", () => {
    const base = {
      merchantId: MERCHANT_ID,
      orderId: ORDER_ID,
      currency: "USD",
      merchantSecret: MERCHANT_SECRET,
    };

    expect(checkoutHash({ ...base, amount: "6.56" })).not.toBe(
      checkoutHash({ ...base, amount: "6.560" }),
    );
  });
});

describe("notificationSignature", () => {
  const notification = {
    merchantId: MERCHANT_ID,
    orderId: ORDER_ID,
    amount: "6.56",
    currency: "USD",
    statusCode: "2",
    merchantSecret: MERCHANT_SECRET,
  };

  it("matches PayHere's formula", () => {
    expect(notificationSignature(notification)).toBe(
      "6C4EFDF2C528F370502B0A63742465F1",
    );
  });

  // The status code is inside the signature, which is the whole reason a
  // failure cannot be replayed as a success.
  it("differs between a success and a failure", () => {
    expect(notificationSignature(notification)).not.toBe(
      notificationSignature({ ...notification, statusCode: "-2" }),
    );
  });

  it("is not the checkout hash", () => {
    expect(notificationSignature(notification)).not.toBe(
      checkoutHash({
        merchantId: MERCHANT_ID,
        orderId: ORDER_ID,
        amount: "6.56",
        currency: "USD",
        merchantSecret: MERCHANT_SECRET,
      }),
    );
  });
});

describe("verifyNotification", () => {
  const expected = "6C4EFDF2C528F370502B0A63742465F1";

  it("accepts the matching signature", () => {
    expect(verifyNotification(expected, expected)).toBe(true);
  });

  it("accepts a lower-case one", () => {
    expect(verifyNotification(expected.toLowerCase(), expected)).toBe(true);
  });

  it("rejects a different signature", () => {
    expect(verifyNotification("0".repeat(32), expected)).toBe(false);
  });

  // The comparison is length-guarded before it is timing-safe, because
  // timingSafeEqual throws on mismatched buffers rather than returning false.
  it("rejects a truncated one without throwing", () => {
    expect(verifyNotification("6C4EFDF2", expected)).toBe(false);
  });

  it("rejects a missing one", () => {
    expect(verifyNotification(null, expected)).toBe(false);
    expect(verifyNotification(undefined, expected)).toBe(false);
    expect(verifyNotification("", expected)).toBe(false);
  });
});
