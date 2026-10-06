import "server-only";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createClient } from "@/lib/supabase/server";
import { billingConfigured } from "./provider";
import { subscriptionFor } from "./server";
import { isPro } from "./subscription";

/**
 * Pro, checked on the server, for data that costs money to fetch.
 *
 * **The one plan gate besides the book count that the server enforces**, and
 * the reason is the house rule it follows: the browser gates are honest only
 * because nothing they guard costs anything to run. Amazon's best-seller data
 * is paid for per request, so a free account must not be able to get it by
 * calling the route directly.
 *
 * The order is `requireLaunchExport()`'s, for the same reasons:
 * - no Supabase means a local-only build with no accounts, so there is nobody
 *   to refuse;
 * - signed out is a 401;
 * - **no billing configured means no plans and nothing held back** — the rule
 *   `billingConfigured()` states, and the reason production must never run
 *   with its Paddle variables unset;
 * - otherwise the caller's subscription decides, and a free account is a 402
 *   carrying `upgrade: true`.
 *
 * Returns `null` to allow, or the refusal to send.
 */
export async function requireProData(what: string): Promise<Response | null> {
  if (!isSupabaseConfigured()) return null;

  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const userId = typeof data?.claims?.sub === "string" ? data.claims.sub : null;
  if (!userId) {
    return Response.json({ error: `Sign in to see ${what}.` }, { status: 401 });
  }

  if (!billingConfigured()) return null;

  if (isPro(await subscriptionFor(supabase, userId))) return null;

  return Response.json(
    { error: `${what[0].toUpperCase()}${what.slice(1)} is part of Pro.`, upgrade: true },
    { status: 402 },
  );
}
