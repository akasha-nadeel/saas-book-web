import { asPeriod, displayPrice, priceOf, type Period } from "@/lib/billing/plans";
import { asPaidTier, TIER_NAMES } from "@/lib/billing/tiers";
import { STARTER_PASS } from "@/lib/billing/starter-pass";
import type { InterestPeriod, InterestTier } from "@/lib/plan-interest";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { isEmailConfigured, sendEmail } from "@/lib/email/send";
import { CONTACT_EMAIL } from "@/lib/legal";

/**
 * Somebody pressed a paid plan while the plans are not on sale.
 *
 * `PLANS_ON_SALE` is false, so those buttons open the "Available Soon" dialog
 * rather than a checkout. Without this route that press would vanish, and the
 * one thing a pricing page is good for while it cannot sell — telling you what
 * people came to buy — would be thrown away with it.
 *
 * **A courtesy endpoint, and it must behave like one.** It always answers
 * `{ ok: true }`, whatever fails inside. The dialog opens on the press and
 * never waits for this; a recording that breaks must not take the explanation
 * with it, which is the same reasoning the invitation mail follows — the row
 * is the feature, the mail is best-effort, and neither is allowed to become an
 * error in front of somebody.
 *
 * **It guards itself, because nothing above it does.** `src/proxy.ts` skips
 * `/api` by design, so this is reachable signed out — which is the point, the
 * people worth hearing about are the ones without accounts. What protects it is
 * the shape of what it accepts rather than who is asking.
 */

export const dynamic = "force-dynamic";

/** Where the press happened. Curiosity on the landing page, intent on /upgrade. */
type Source = "upgrade" | "landing";

function asSource(value: unknown): Source | null {
  return value === "upgrade" || value === "landing" ? value : null;
}

/**
 * The pass narrows on its own, because `asPaidTier` will not take it.
 *
 * That refusal is correct — a `PaidTier` is something a subscription can be —
 * so the pass is checked beside it rather than by widening the type every gate
 * in the billing code reads. Both still end up narrowed before anything is
 * written; nothing here trusts the body.
 */
function asInterestTier(value: unknown): InterestTier | null {
  return value === "pass" ? "pass" : asPaidTier(value);
}

function asInterestPeriod(value: unknown): InterestPeriod | null {
  return value === "once" ? "once" : asPeriod(value);
}

/**
 * What was wanted, said the way the pricing page says it.
 *
 * The pass has no `TIER_NAMES` entry and no `priceOf` — it is not a tier and
 * has no cycle — so it is named from `STARTER_PASS` instead of being forced
 * through helpers that describe subscriptions.
 */
function describe(
  tier: InterestTier,
  period: InterestPeriod,
): { name: string; terms: string } {
  if (tier === "pass") {
    return {
      name: "the Starter Pass",
      terms: `${displayPrice(STARTER_PASS.price)}, charged once`,
    };
  }
  /* `once` cannot reach here — POST refuses a plan carrying it — but the two
     narrowings happen on separate fields and TypeScript cannot see the pairing
     between them, so the cycle is settled rather than asserted. */
  const cycle: Period = period === "once" ? "monthly" : period;
  return {
    name: TIER_NAMES[tier],
    terms: `${cycle === "annual" ? "annual" : "monthly"}, ${displayPrice(priceOf(tier, cycle))}`,
  };
}

/**
 * The hour this press falls in, as Resend's idempotency key.
 *
 * **This is the rate limiter, and it is deliberately not a rate limiter.**
 * There is none in this repo and adding one for a button press would be out of
 * proportion — but a public endpoint that sends mail is a spam vector, and
 * saying so and doing nothing is not an answer either.
 *
 * Keying the send on `<tier>/<period>/<hour>` hands the job to the thing that
 * would otherwise be abused: Resend refuses a duplicate key, so a hostile loop
 * produces **at most one email per plan per cycle per hour** — six an hour,
 * whatever arrives — while every press still lands as a row. The signal
 * survives; the inbox does not fill.
 */
function sendKey(
  tier: InterestTier,
  period: InterestPeriod,
  at: Date,
): string {
  const hour = at.toISOString().slice(0, 13); // YYYY-MM-DDTHH
  return `plan-interest/${tier}/${period}/${hour}`;
}

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as {
    tier?: unknown;
    period?: unknown;
    source?: unknown;
  } | null;

  /* **Three enums and nothing else.** No free text anywhere in the payload, so
     header injection and content spam are not defended against so much as made
     impossible — there is no field for a stranger to put a sentence in. The
     only text that ever reaches the email is an address out of a verified
     session. */
  const tier = asInterestTier(body?.tier);
  const period = asInterestPeriod(body?.period);
  const source = asSource(body?.source);

  if (!tier || !period || !source) {
    /* Still 200. A malformed press is nothing to tell a visitor about, and the
       browser that sent it has no interface for the news. */
    return Response.json({ ok: true });
  }

  /* **`once` belongs to the pass and to nothing else.** Each field narrows on
     its own, so "studio, once" and "pass, annual" both survive that and would
     land as rows describing products this app does not sell. Refused here
     rather than left to the CHECK constraints, which would take the row but
     lose the reason. */
  if ((tier === "pass") !== (period === "once")) {
    return Response.json({ ok: true });
  }

  /* Who they are, if they are anybody. A signed-out press is the interesting
     one and is recorded with both fields null. */
  let owner: string | null = null;
  let email: string | null = null;

  if (isSupabaseConfigured()) {
    try {
      const supabase = await createClient();
      const { data } = await supabase.auth.getClaims();
      const claims = data?.claims;
      owner = typeof claims?.sub === "string" ? claims.sub : null;
      email = typeof claims?.email === "string" ? claims.email : null;
    } catch {
      /* A session that cannot be read is a signed-out press as far as this is
         concerned. Nothing here is worth failing over. */
    }
  }

  const db = createAdminClient();
  if (db) {
    const { error } = await db
      .from("plan_interest")
      .insert({ tier, period, source, owner, email });

    if (error) {
      /* Named rather than swallowed, because the failure everybody actually
         hits is the migration not having been applied — PGRST205 for a table
         PostgREST has never seen. The feedback dialog names its migration for
         the same reason. */
      console.error("[interest] could not record the press", {
        code: error.code,
        message: error.message,
        hint:
          error.code === "PGRST205" || error.code === "42P01"
            ? "supabase/migrations/20260907000000_plan_interest.sql has not been applied"
            : undefined,
      });
    }
  }

  if (isEmailConfigured()) {
    const now = new Date();
    const { name, terms } = describe(tier, period);
    const who = email ?? "a signed-out visitor";
    const where = source === "landing" ? "the landing page" : "the plans page";

    const line = `${who} pressed ${name} (${terms}) on ${where}.`;

    const sent = await sendEmail({
      to: CONTACT_EMAIL,
      subject: `Someone wanted ${name}`,
      text: `${line}\n\nThe plans are not on sale, so they saw the "Available Soon" dialog. Every press is in the plan_interest table; this mail is one per plan per cycle per hour.`,
      html: `<p>${line}</p><p>The plans are not on sale, so they saw the &ldquo;Available Soon&rdquo; dialog. Every press is in the <code>plan_interest</code> table; this mail is one per plan per cycle per hour.</p>`,
      idempotencyKey: sendKey(tier, period, now),
    });

    if (!sent.sent) {
      /* Logged, never surfaced. The row is the feature. */
      console.error("[interest] could not send the alert", {
        reason: sent.reason,
        detail: sent.detail,
      });
    }
  }

  return Response.json({ ok: true });
}
