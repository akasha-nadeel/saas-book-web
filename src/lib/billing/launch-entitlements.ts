import { LAUNCH_LIMITS, exportAllowed } from "@/lib/launch";
import { type PlanTier } from "@/lib/billing/tiers";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createClient } from "@/lib/supabase/server";
import { billingConfigured } from "./provider";
import { subscriptionFor } from "./server";
import { isPro } from "./subscription";

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
