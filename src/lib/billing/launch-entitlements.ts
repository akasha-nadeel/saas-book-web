import type { SupabaseClient } from "@supabase/supabase-js";
import { LAUNCH_LIMITS, exportAllowed } from "@/lib/launch";
import { CREDIT_COST, monthlyCredits } from "@/lib/billing/credits";
import { type PlanTier } from "@/lib/billing/tiers";
import type { ChatModel } from "@/lib/ai";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createClient } from "@/lib/supabase/server";
import { billingConfigured } from "./provider";
import { subscriptionFor } from "./server";
import { isPro, planTierOf, type Subscription } from "./subscription";

/**
 * What a writer has left to spend on the assistant.
 *
 * **Two buckets, because they behave differently.** The monthly grant expires
 * at the end of the month; bought credits do not. A screen prints `total`, and
 * `/billing` prints the split so a writer can see what they will lose on the
 * 1st and what they will not.
 *
 * `null` everywhere means *nothing is metered here* — no Supabase, or no
 * payment gateway, which is the self-hosted case. It is `null` rather than
 * `Infinity` because this crosses `/api/billing/subscription` as JSON.
 */
export interface CreditBalance {
  /** Left in this UTC month's grant. */
  grantLeft: number | null;
  /** Bought credits, which do not expire. */
  purchased: number | null;
  /** The two together — what a writer can actually spend right now. */
  total: number | null;
  /** When the grant refills, as an instant. Rendered in local time. */
  resetAt: string | null;
}

const UNMETERED: CreditBalance = {
  grantLeft: null,
  purchased: null,
  total: null,
  resetAt: null,
};

interface CreditClaimRow {
  allowed?: unknown;
  tier?: unknown;
  grant_left?: unknown;
  purchased_left?: unknown;
  reset_at?: unknown;
  from_grant?: unknown;
  from_purchased?: unknown;
}

function asCount(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

/**
 * The window the grant runs on, matching `claim_credits` exactly.
 *
 * **UTC, which is not the writer's midnight.** A reset at 00:00 UTC on the 1st
 * is 05:30 in Colombo and 7pm on the last of the month in Los Angeles, so
 * `resetAt` is returned as an instant and every screen renders it in local time
 * rather than calling it "next month".
 */
function monthWindow(now = new Date()): { start: Date; reset: string } {
  const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const reset = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1));
  return { start, reset: reset.toISOString() };
}

function balanceFrom(row: CreditClaimRow): CreditBalance {
  const grantLeft = asCount(row.grant_left);
  const purchased = asCount(row.purchased_left);
  return {
    grantLeft,
    purchased,
    total: grantLeft + purchased,
    resetAt: typeof row.reset_at === "string" ? row.reset_at : null,
  };
}

/**
 * What the balance stands at, without spending anything.
 *
 * Read rather than claimed, because `/billing` and the account menu ask this on
 * every load and a claim would charge them for looking.
 *
 * **It re-derives the grant rather than trusting the stored count**, for the
 * one case the stored row cannot answer: a writer whose last reply was in
 * August has `grant_spent` from August still on the row, because nothing rolls
 * it over until the next claim. Comparing the stamp to this month is what stops
 * the panel showing an empty allowance on the 1st.
 */
export async function creditBalanceFor(
  supabase: SupabaseClient,
  owner: string,
  subscription: Subscription | null,
): Promise<CreditBalance> {
  if (!billingConfigured()) return UNMETERED;

  const tier = planTierOf(subscription);
  const { start, reset } = monthWindow();
  const limit = monthlyCredits(tier);

  const { data } = await supabase
    .from("ai_credits")
    .select("grant_spent, grant_period_start, purchased")
    .eq("owner", owner)
    .maybeSingle();

  const row = data as {
    grant_spent?: unknown;
    grant_period_start?: unknown;
    purchased?: unknown;
  } | null;

  const stampedAt =
    typeof row?.grant_period_start === "string"
      ? Date.parse(row.grant_period_start)
      : NaN;
  const staleMonth = Number.isNaN(stampedAt) || stampedAt < start.getTime();

  const spent = staleMonth ? 0 : asCount(row?.grant_spent);
  const grantLeft = Math.max(limit - spent, 0);
  const purchased = asCount(row?.purchased);

  return { grantLeft, purchased, total: grantLeft + purchased, resetAt: reset };
}

export type CreditClaim =
  | {
      ok: true;
      /** What this reply cost. Zero when nothing is metered. */
      cost: number;
      balance: CreditBalance;
      /** Puts it back, to the buckets it came from, if the reply never lands. */
      refund: () => Promise<void>;
    }
  | { ok: false; response: Response };

/**
 * Spends one reply's worth of credits, or refuses.
 *
 * **Postgres decides.** `claim_credits` locks the row, rolls the month if it
 * needs to, spends the expiring grant before the bought balance and refuses
 * when the two together fall short — all inside one statement, which is what
 * keeps two replies fired at once from both spending the last credit.
 *
 * With no Supabase or no payment gateway there is nothing to meter and this
 * passes everyone: a self-hosted copy running on its owner's own API key keeps
 * the assistant it always had.
 */
export async function claimCredits(model: ChatModel): Promise<CreditClaim> {
  const cost = CREDIT_COST[model];

  if (!isSupabaseConfigured() || !billingConfigured()) {
    return { ok: true, cost: 0, balance: UNMETERED, refund: async () => {} };
  }

  const supabase = await createClient();
  const { data: claims } = await supabase.auth.getClaims();
  const userId =
    typeof claims?.claims?.sub === "string" ? claims.claims.sub : null;

  if (!userId) {
    return {
      ok: false,
      response: Response.json(
        { error: "Sign in to use the writing assistant." },
        { status: 401 },
      ),
    };
  }

  const { data, error } = await supabase.rpc("claim_credits", {
    p_cost: cost,
  });
  if (error) {
    console.error("[credits] claim failed", error);
    return {
      ok: false,
      response: Response.json(
        { error: "Could not check your credit balance." },
        { status: 502 },
      ),
    };
  }

  const row = (Array.isArray(data) ? data[0] : data) as CreditClaimRow | null;
  if (!row) {
    return {
      ok: false,
      response: Response.json(
        { error: "Could not check your credit balance." },
        { status: 502 },
      ),
    };
  }

  const balance = balanceFrom(row);

  /**
   * **429 always means "out of credits", never "wrong plan".**
   *
   * A plan with no assistant is refused by the route before it reaches this
   * claim, so anything arriving here is entitled to the assistant and has
   * simply spent what it had. That keeps the pair of codes clean for the panel
   * to branch on: 402 is "your plan does not include this", 429 is "buy more or
   * wait for the 1st".
   */
  if (row.allowed !== true) {
    return {
      ok: false,
      response: Response.json(
        {
          error: `That reply costs ${cost} credits and you have ${balance.total} left.`,
          kind: model,
          cost,
          credits: balance,
        },
        { status: 429 },
      ),
    };
  }

  const fromGrant = asCount(row.from_grant);
  const fromPurchased = asCount(row.from_purchased);

  return {
    ok: true,
    cost,
    balance,
    refund: async () => {
      await supabase
        .rpc("refund_credits", {
          p_from_grant: fromGrant,
          p_from_purchased: fromPurchased,
        })
        .then(({ error: refundError }) => {
          if (refundError) {
            console.error("[credits] refund failed", refundError);
          }
        });
    },
  };
}

export async function requireLaunchExport(format: string): Promise<Response | null> {
  if (!isSupabaseConfigured()) return null;

  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const userId = typeof data?.claims?.sub === "string" ? data.claims.sub : null;

  if (!userId) {
    return Response.json(
      { error: "Sign in to export your book." },
      { status: 401 },
    );
  }

  /* **Free to everybody: there is nothing to ask the gateway.** Every format
     is on both plans (`LAUNCH_LIMITS`), so a subscription lookup here would be
     a Postgres round trip on every export that could only ever answer yes. The
     check above it stays, because free is not the same as anonymous — this
     route launches a browser on markup the caller wrote. */
  if (exportAllowed(format, false)) return null;

  if (!billingConfigured()) return null;

  const subscription = await subscriptionFor(supabase, userId);
  if (exportAllowed(format, isPro(subscription))) return null;

  /* Unreachable while the two arrays match, and written from the data rather
     than from the formats' names so it cannot start lying if they stop. */
  return Response.json(
    {
      error: `Your plan includes ${LAUNCH_LIMITS.freeExports.join(", ")} export.`,
      upgrade: true,
    },
    { status: 402 },
  );
}

/** Re-exported so callers that only want the tier type need not reach further. */
export type { PlanTier };
