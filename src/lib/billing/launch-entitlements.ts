import type { SupabaseClient } from "@supabase/supabase-js";
import { LAUNCH_LIMITS, exportAllowed } from "@/lib/launch";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createClient } from "@/lib/supabase/server";
import { billingConfigured } from "./provider";
import { subscriptionFor } from "./server";
import { isPro, type Subscription } from "./subscription";

export interface AssistantUsage {
  used: number;
  limit: number | null;
  remaining: number | null;
  resetAt: string | null;
}

interface AssistantClaimRow {
  allowed?: unknown;
  pro?: unknown;
  used?: unknown;
  limit_count?: unknown;
  remaining?: unknown;
  reset_at?: unknown;
}

const ASSISTANT_USAGE_KEY = "assistant_reply";

function monthWindow(now = new Date()): { start: string; reset: string } {
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

export async function assistantUsageFor(
  supabase: SupabaseClient,
  owner: string,
  subscription: Subscription | null,
): Promise<AssistantUsage> {
  const pro = isPro(subscription);
  if (!billingConfigured()) {
    return { used: 0, limit: null, remaining: null, resetAt: null };
  }

  const { start, reset } = monthWindow();
  const limit = pro ? 60 : 5;
  const { data } = await supabase
    .from("ai_usage")
    .select("used")
    .eq("owner", owner)
    .eq("usage_key", ASSISTANT_USAGE_KEY)
    .gte("period_start", start)
    .lt("period_start", reset)
    .maybeSingle();

  const used =
    typeof (data as { used?: unknown } | null)?.used === "number"
      ? (data as { used: number }).used
      : 0;

  return {
    used,
    limit,
    remaining: Math.max(limit - used, 0),
    resetAt: reset,
  };
}

export type AssistantClaim =
  | {
      ok: true;
      usage: AssistantUsage;
      refund: () => Promise<void>;
    }
  | { ok: false; response: Response };

export async function claimAssistantReplyAllowance(): Promise<AssistantClaim> {
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

  const { data, error } = await supabase.rpc("claim_assistant_reply");
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
  const pro = row.pro === true;

  if (!allowed) {
    return {
      ok: false,
      response: Response.json(
        {
          error: pro
            ? "You've used your Pro assistant allowance for this month."
            : "You've used your free assistant replies for this month. Upgrade to Pro for more assistant help.",
          upgrade: !pro,
          usage,
        },
        { status: pro ? 429 : 402 },
      ),
    };
  }

  return {
    ok: true,
    usage,
    refund: async () => {
      await supabase.rpc("refund_assistant_reply").then(({ error: refundError }) => {
        if (refundError) console.error("[assistant-usage] refund failed", refundError);
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
