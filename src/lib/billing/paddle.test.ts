import { describe, expect, it, vi } from "vitest";
import {
  isPaddleSetupFault,
  paddleErrorCode,
  paddleSandboxFrom,
  paddleStatus,
} from "./paddle";

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

/**
 * The other silent failure, and the one that cost the Update button.
 *
 * `PADDLE_ENV` is not a NEXT_PUBLIC_ name, so it is undefined in a client
 * bundle; the config read there therefore always answered sandbox, and
 * Paddle.js will not start with a live token against the sandbox. Nothing on
 * screen could say why the card dialog never opened.
 */
describe("paddleSandboxFrom", () => {
  it("lets an explicit setting decide, whatever the keys look like", () => {
    expect(paddleSandboxFrom("production", "pdl_sdbx_apikey_x", "test_x")).toBe(
      false,
    );
    expect(paddleSandboxFrom("sandbox", "pdl_live_apikey_x", "live_x")).toBe(true);
  });

  it("reads live credentials as production when nothing is set", () => {
    expect(paddleSandboxFrom(undefined, "pdl_live_apikey_x", "live_x")).toBe(false);
    // The client half: no API key survives into the browser, so the token
    // has to be able to answer on its own.
    expect(paddleSandboxFrom(undefined, "", "live_x")).toBe(false);
    // And the server half, before a client token is even read.
    expect(paddleSandboxFrom(undefined, "pdl_live_apikey_x", "")).toBe(false);
  });

  it("stays on sandbox for sandbox keys and for nothing at all", () => {
    expect(paddleSandboxFrom(undefined, "pdl_sdbx_apikey_x", "test_x")).toBe(true);
    expect(paddleSandboxFrom(undefined, "", "")).toBe(true);
    expect(paddleSandboxFrom("", "", "")).toBe(true);
  });
});

/**
 * The refusal the Upgrade button spent its life reporting as a glitch.
 *
 * A live account, a valid key and two active prices, and every
 * `transactions.create` still came back refused because no default payment link
 * had been set in the Paddle dashboard. The route answered "try again shortly",
 * which was a promise nothing could keep.
 */
describe("paddleErrorCode / isPaddleSetupFault", () => {
  // The shape the SDK actually threw, kept verbatim.
  const noPaymentLink = {
    type: "request_error",
    code: "transaction_default_checkout_url_not_set",
    detail:
      "Cannot create a transaction or open a checkout as no default payment link has been set for this account. Set in the Paddle dashboard, then try again.",
  };

  it("reads the code off a Paddle refusal", () => {
    expect(paddleErrorCode(noPaymentLink)).toBe(
      "transaction_default_checkout_url_not_set",
    );
  });

  it("finds no code on anything that is not one", () => {
    expect(paddleErrorCode(new Error("socket hang up"))).toBeNull();
    expect(paddleErrorCode(null)).toBeNull();
    expect(paddleErrorCode("forbidden")).toBeNull();
    expect(paddleErrorCode({ code: 42 })).toBeNull();
  });

  it("calls a missing payment link somebody's to fix, not something to retry", () => {
    expect(isPaddleSetupFault(noPaymentLink)).toBe(true);
    expect(isPaddleSetupFault({ code: "forbidden" })).toBe(true);
  });

  /*
   * The default has to stay "retry". A network blip, a Paddle outage and a code
   * this version has never seen are all cases where trying again is the honest
   * advice, and only a code known to be permanent may take it away.
   */
  it("leaves everything else retryable", () => {
    expect(isPaddleSetupFault(new Error("ECONNRESET"))).toBe(false);
    expect(isPaddleSetupFault({ code: "internal_error" })).toBe(false);
    expect(isPaddleSetupFault({ code: "too_many_requests" })).toBe(false);
    expect(isPaddleSetupFault(undefined)).toBe(false);
  });
});

/**
 * **The function that decides which plan a webhook just paid for.**
 *
 * `paddle/notify` has no other way to know. It deliberately does *not* read
 * Paddle's own billing interval — that would work today and break the day
 * somebody adds a quarterly price, because `period` and `plan` are both CHECK
 * constraints and a row that fails one aborts the write for money already
 * taken. So it maps the returned price ids back through our own table, and this
 * is the test that map has never had.
 *
 * `PRICE_IDS` is captured at module load, so every case resets the registry and
 * re-imports rather than sharing one instance.
 */
describe("paddlePlanFrom", () => {
  const IDS = {
    PADDLE_PRICE_DRAFT_MONTHLY: "pri_draft_m",
    PADDLE_PRICE_DRAFT_ANNUAL: "pri_draft_a",
    PADDLE_PRICE_WRITER_MONTHLY: "pri_writer_m",
    PADDLE_PRICE_WRITER_ANNUAL: "pri_writer_a",
    PADDLE_PRICE_STUDIO_MONTHLY: "pri_studio_m",
    PADDLE_PRICE_STUDIO_ANNUAL: "pri_studio_a",
  } as const;

  async function withPrices() {
    const saved = Object.fromEntries(
      Object.keys(IDS).map((k) => [k, process.env[k]]),
    );
    for (const [key, value] of Object.entries(IDS)) process.env[key] = value;

    vi.resetModules();
    const mod = await import("./paddle");

    for (const [key, value] of Object.entries(saved)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
    return mod;
  }

  it("names the plan and the cycle behind each of the six prices", async () => {
    const { paddlePlanFrom } = await withPrices();

    expect(paddlePlanFrom(["pri_draft_m"])).toEqual({
      tier: "draft",
      period: "monthly",
    });
    expect(paddlePlanFrom(["pri_writer_a"])).toEqual({
      tier: "writer",
      period: "annual",
    });
    expect(paddlePlanFrom(["pri_studio_m"])).toEqual({
      tier: "studio",
      period: "monthly",
    });
  });

  it("refuses a price it does not recognise", async () => {
    const { paddlePlanFrom } = await withPrices();

    // Somebody else's price, or one made in the dashboard and never wired up.
    expect(paddlePlanFrom(["pri_somebody_elses"])).toBeNull();
    expect(paddlePlanFrom([])).toBeNull();
    expect(paddlePlanFrom([undefined])).toBeNull();
  });

  /**
   * **Two of ours at once is the case a naive version guesses at**, and the one
   * that would grant a plan nobody bought. A subscription naming both Draft and
   * Studio is a shape this app does not sell; the honest answer is "I do not
   * know", which the route already handles by logging and granting nothing.
   */
  it("refuses to choose when two of our prices arrive together", async () => {
    const { paddlePlanFrom } = await withPrices();

    expect(paddlePlanFrom(["pri_draft_m", "pri_studio_a"])).toBeNull();
    expect(paddlePlanFrom(["pri_writer_m", "pri_writer_a"])).toBeNull();
  });

  it("ignores unknown ids travelling beside a known one", async () => {
    const { paddlePlanFrom } = await withPrices();

    // One of ours plus an add-on we do not sell is still unambiguous.
    expect(paddlePlanFrom(["pri_addon", "pri_writer_m"])).toEqual({
      tier: "writer",
      period: "monthly",
    });
  });
});
