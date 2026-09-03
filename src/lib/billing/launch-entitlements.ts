import type { SupabaseClient } from "@supabase/supabase-js";
import { LAUNCH_LIMITS, exportAllowed } from "@/lib/launch";
import { TIER_LIMITS, type PlanTier } from "@/lib/billing/tiers";
import type { ChatModel } from "@/lib/ai";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createClient } from "@/lib/supabase/server";
import { billingConfigured } from "./provider";
import { subscriptionFor } from "./server";
import { isPro, planTierOf, type Subscription } from "./subscription";

export interface AssistantUsage {
  used: number;
  limit: number | null;
  remaining: number | null;
  resetAt: string | null;
}

interface AssistantClaimRow {
  allowed?: unknown;
  tier?: unknown;
  used?: unknown;
  limit_count?: unknown;
  remaining?: unknown;
  reset_at?: unknown;
}

/**
 * The two meters, and the row each one counts in `ai_usage`.
 *
 * Separate keys rather than one with a kind column, because the primary key is
 * `(owner, usage_key, period_start)` and the two windows differ: Quick's
 * `period_start` is a day and Careful's is a month. One key would collide the
 * moment both were used in the same hour.
 */
const USAGE_KEY: Record<ChatModel, string> = {
  quick: "assistant_quick",
  careful: "assistant_careful",
};

/** What each meter is capped at, and how far back its window reaches. */
function allowanceOf(tier: PlanTier, model: ChatModel): number {
  return model === "quick"
    ? TIER_LIMITS[tier].quickPerDay
    : TIER_LIMITS[tier].carefulPerMonth;
}

/**
 * The window one meter counts in, matching `claim_assistant_reply` exactly.
 *
 * **UTC, which is not the writer's midnight.** A daily reset at 00:00 UTC is
 * 05:30 in Colombo and 7pm the previous day in Los Angeles, so `reset` is
 * returned as an instant and every screen renders it in local time rather than
 * calling it "tomorrow".
 */
function windowFor(
  model: ChatModel,
  now = new Date(),
): { start: string; reset: string } {
  if (model === "quick") {
    const start = new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()),
    );
    const reset = new Date(start.getTime());
    reset.setUTCDate(reset.getUTCDate() + 1);
    return { start: start.toISOString(), reset: reset.toISOString() };
  }

  const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const reset = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1));
  return { start: start.toISOString(), reset: reset.toISOString() };
}

function usageFromClaim(row: AssistantClaimRow): AssistantUsage {
  const used = typeof row.used === "number" && Number.isFinite(row.used)
    ? row.used
    : 0;
  const limit =
    typeof row.limit_count === "number" && Number.isFinite(row.limit_count)
      ? row.limit_count
      : null;
  const remaining =
    typeof row.remaining === "number" && Number.isFinite(row.remaining)
      ? row.remaining
      : limit === null
        ? null
        : Math.max(limit - used, 0);
  const resetAt = typeof row.reset_at === "string" ? row.reset_at : null;

  return { used, limit, remaining, resetAt };
}

/** Both meters, as `/billing` and the assistant panel show them. */
export interface AssistantMeters {
  quick: AssistantUsage;
  careful: AssistantUsage;
}

async function meterFor(
  supabase: SupabaseClient,
  owner: string,
  tier: PlanTier,
  model: ChatModel,
): Promise<AssistantUsage> {
  const { start, reset } = windowFor(model);
  const limit = allowanceOf(tier, model);

  const { data } = await supabase
    .from("ai_usage")
    .select("used")
    .eq("owner", owner)
    .eq("usage_key", USAGE_KEY[model])
    .gte("period_start", start)
    .lt("period_start", reset)
    .maybeSingle();

  const used =
    typeof (data as { used?: unknown } | null)?.used === "number"
      ? (data as { used: number }).used
      : 0;

  return { used, limit, remaining: Math.max(limit - used, 0), resetAt: reset };
}

/**
 * What both meters stand at.
 *
 * **The limits are read from `TIER_LIMITS`, never typed here.** They used to be
 * `pro ? 60 : 5` written into this function, which made three copies of two
 * numbers — this file, `launch.ts`, and the SQL. Two is the floor, because SQL
 * cannot import TypeScript; three was a drift waiting to happen.
 */
export async function assistantUsageFor(
  supabase: SupabaseClient,
  owner: string,
  subscription: Subscription | null,
): Promise<AssistantMeters> {
  const unmetered: AssistantUsage = {
    used: 0,
    limit: null,
    remaining: null,
    resetAt: null,
  };

  if (!billingConfigured()) {
    return { quick: unmetered, careful: unmetered };
  }

  const tier = planTierOf(subscription);
  const [quick, careful] = await Promise.all([
    meterFor(supabase, owner, tier, "quick"),
    meterFor(supabase, owner, tier, "careful"),
  ]);

  return { quick, careful };
}



export type AssistantClaim =
  | {
      ok: true;
      usage: AssistantUsage;
      refund: () => Promise<void>;
    }
  | { ok: false; response: Response };

export async function claimAssistantReplyAllowance(
  model: ChatModel,
): Promise<AssistantClaim> {
  if (!isSupabaseConfigured() || !billingConfigured()) {
    return {
      ok: true,
      usage: { used: 0, limit: null, remaining: null, resetAt: null },
      refund: async () => {},
    };
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

  const { data, error } = await supabase.rpc("claim_assistant_reply", {
    p_kind: model,
  });
  if (error) {
    console.error("[assistant-usage] claim failed", error);
    return {
      ok: false,
      response: Response.json(
        { error: "Could not check your assistant allowance." },
        { status: 502 },
      ),
    };
  }

  const row = (Array.isArray(data) ? data[0] : data) as AssistantClaimRow | null;
  if (!row) {
    return {
      ok: false,
      response: Response.json(
        { error: "Could not check your assistant allowance." },
        { status: 502 },
      ),
    };
  }

  const usage = usageFromClaim(row);
  const allowed = row.allowed === true;

  /**
   * **429 always means "out of this allowance", never "wrong plan".**
   *
   * A plan with no assistant is refused by the route before it reaches this
   * claim, so anything arriving here is on a plan that has the assistant and
   * has simply spent one of its two meters. That makes the pair of codes clean
   * for the panel to branch on: 402 is "your plan does not include this", 429 is
   * "come back when it refills".
   */
  if (!allowed) {
    const window = model === "quick" ? "today" : "this month";
    return {
      ok: false,
      response: Response.json(
        {
          error: `You've used your ${model} assistant replies for ${window}.`,
          kind: model,
          usage,
        },
        { status: 429 },
      ),
    };
  }

  return {
    ok: true,
    usage,
    refund: async () => {
      await supabase
        .rpc("refund_assistant_reply", { p_kind: model })
        .then(({ error: refundError }) => {
          if (refundError) {
            console.error("[assistant-usage] refund failed", refundError);
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
