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

/**
 * Where the alert goes.
 *
 * **`CONTACT_EMAIL` is the address on the site, which is not the same thing as
 * an address somebody reads.** It is published for writers to reach support at,
 * and on a domain whose mail is set up to *send*; the first twelve alerts were
 * accepted by Resend and delivered to a mailbox nobody was watching. An
 * operational alert wants the inbox its owner actually opens, and that is not a
 * fact about the product, so it is configuration rather than a constant.
 *
 * Falls back to the published address, which keeps a self-hosted copy working
 * without a setting and is the right destination when the domain does have a
 * mailbox.
 */
function alertAddress(): string {
  return process.env.PLAN_INTEREST_ALERT_EMAIL?.trim() || CONTACT_EMAIL;
}

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

/* **There was an idempotency key here, and it was the wrong instrument.**
   Resend refuses a repeat of one, which looked like a free rate limiter: one
   mail per plan per cycle per hour, and the key carried the hour. Two things
   were wrong with it. Its window is 24 hours rather than the hour encoded, so
   the key was doing something other than it read as; and a repeat whose *body*
   differs is refused with a 409 rather than quietly deduped — and the body
   names who pressed and where they were, so the second person to want Studio
   in an hour produced no mail and an error in the log. That is precisely the
   press this feature exists to hear about.

   The cap now counts rows in `plan_interest` instead. See `alreadyAlerted`. */

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

  /**
   * Whether this plan has already been mailed about in the last hour.
   *
   * **The ledger is the rate limiter, now that there is one.** The first
   * version handed the job to Resend's idempotency key, which was wrong twice:
   * the window is 24 hours rather than the hour the key encoded, and a reused
   * key whose *body* differs is refused outright with a 409. The body carries
   * who pressed and where — so the second person to want Studio in a given hour
   * sent no mail and logged an error, which is the one case this feature exists
   * to catch.
   *
   * **Counting rows was the second wrong answer, for a subtler reason.** A row
   * means somebody pressed; it does not mean anybody was told. Five Starter
   * Pass presses landed during the hour every send was being refused, and the
   * cap then read those five as "already reported" and kept suppressing the one
   * plan that had never once been mailed about. The count now reads
   * `alerted_at`, which is written only after the provider has taken the
   * message — so a failed send leaves the next press free to try again.
   *
   * Starts false so a deployment with no database still mails: an uncapped
   * alert is a worse day than a missed one, but a *silent* one is worse than
   * both, which is the failure this whole comment is a record of.
   */
  let alreadyAlerted = false;
  /** The row just written, so the send can mark it. */
  let rowId: string | null = null;

  const db = createAdminClient();
  if (db) {
    const { data: inserted, error } = await db
      .from("plan_interest")
      .insert({ tier, period, source, owner, email })
      .select("id")
      .single();

    rowId = typeof inserted?.id === "string" ? inserted.id : null;

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
    } else {
      /* **Alerts in the last hour, not presses.** This row is not among them:
         it is written with `alerted_at` null and only marked once the mail has
         been accepted, so any count above zero is a message that genuinely
         reached the provider. `head` keeps it a count rather than a fetch of
         rows nobody reads, and a failed count leaves the alert to go out — see
         `alreadyAlerted`. */
      const since = new Date(Date.now() - 60 * 60 * 1000).toISOString();
      const { count } = await db
        .from("plan_interest")
        .select("id", { count: "exact", head: true })
        .eq("tier", tier)
        .eq("period", period)
        .gte("alerted_at", since);

      alreadyAlerted = (count ?? 0) > 0;
    }
  }

  if (isEmailConfigured() && !alreadyAlerted) {
    const { name, terms } = describe(tier, period);
    const who = email ?? "a signed-out visitor";
    const where = source === "landing" ? "the landing page" : "the plans page";

    const line = `${who} pressed ${name} (${terms}) on ${where}.`;

    const sent = await sendEmail({
      to: alertAddress(),
      subject: `Someone wanted ${name}`,
      text: `${line}\n\nThe plans are not on sale, so they saw the "Available Soon" dialog. Every press is in the plan_interest table; this mail is one per plan per cycle per hour.`,
      html: `<p>${line}</p><p>The plans are not on sale, so they saw the &ldquo;Available Soon&rdquo; dialog. Every press is in the <code>plan_interest</code> table; this mail is one per plan per cycle per hour.</p>`,
    });

    if (sent.sent) {
      /* **Marked only now, and this is the whole point of the column.** Written
         alongside the row it would mean "a press happened", which is what the
         row already means; written here it means the provider took the message,
         which is the only thing the hourly cap has any business counting. A
         send that fails leaves it null and the next press is free to try. */
      if (db && rowId) {
        const { error } = await db
          .from("plan_interest")
          .update({ alerted_at: new Date().toISOString() })
          .eq("id", rowId);

        if (error) {
          /* The mail went; only the bookkeeping did not. Worth saying, because
             the visible symptom is the opposite of the fault — alerts that
             repeat rather than alerts that vanish. */
          console.error("[interest] alert sent but not marked", {
            code: error.code,
            message: error.message,
          });
        }
      }
    } else {
      /* Logged, never surfaced. The row is the feature. */
      console.error("[interest] could not send the alert", {
        reason: sent.reason,
        detail: sent.detail,
      });
    }
  }

  return Response.json({ ok: true });
}
