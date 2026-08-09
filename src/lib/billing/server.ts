import type { SupabaseClient } from "@supabase/supabase-js";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createClient } from "@/lib/supabase/server";
import { asProvider, billingConfigured } from "./provider";
import { asPeriod } from "./plans";
import {
  asSubscriptionStatus,
  isPro,
  type Subscription,
} from "./subscription";

/**
 * The server's answer to "what is this writer paying for".
 *
 * Read straight from Postgres every time rather than cached anywhere: the row
 * changes when PayHere says it changes, which is a webhook away and nothing to
 * do with this request. A stale plan is either a writer locked out of what they
 * paid for or a lapsed one still being served, and both are worse than a query.
 */

/**
 * Narrowed on the way out, like the sync mapping is.
 *
 * The types below describe what the app writes today; the table has been in
 * front of a webhook, and a row with a status this version does not know about
 * should read as "no subscription" rather than crash a route handler.
 */
function toSubscription(row: Record<string, unknown> | null): Subscription | null {
  if (!row) return null;

  const status = asSubscriptionStatus(row.status);
  const period = asPeriod(row.period);
  if (!status || !period) return null;

  const end = row.current_period_end;
  const cancelled = row.cancelled_at;

  return {
    // Rows written before the Paddle migration carry no provider column value
    // of their own; `asProvider` reads them as PayHere, which is what they are.
    provider: asProvider(row.provider),
    status,
    period,
    currentPeriodEnd: typeof end === "string" ? new Date(end) : null,
    payhereSubscriptionId:
      typeof row.payhere_subscription_id === "string"
        ? row.payhere_subscription_id
        : null,
    paddleSubscriptionId:
      typeof row.paddle_subscription_id === "string"
        ? row.paddle_subscription_id
        : null,
    cancelledAt: typeof cancelled === "string" ? new Date(cancelled) : null,
  };
}

/**
 * One writer's subscription, read through whichever client is handed in.
 *
 * The client is a parameter because two callers need this with different
 * privileges: a route handler reading the signed-in writer's own row through
 * RLS, and the webhook reading somebody's row with the secret key. Naming the
 * owner explicitly is not redundant in the second case — it is the only thing
 * scoping the query at all.
 */
export async function subscriptionFor(
  supabase: SupabaseClient,
  owner: string,
): Promise<Subscription | null> {
  const { data } = await supabase
    .from("subscriptions")
    .select("*")
    .eq("owner", owner)
    .maybeSingle();

  return toSubscription(data as Record<string, unknown> | null);
}

/** What the signed-in writer's own plan is, for a Server Component or route. */
export async function currentSubscription(): Promise<{
  userId: string | null;
  subscription: Subscription | null;
}> {
  if (!isSupabaseConfigured()) return { userId: null, subscription: null };

  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const userId = typeof data?.claims?.sub === "string" ? data.claims.sub : null;
  if (!userId) return { userId: null, subscription: null };

  return { userId, subscription: await subscriptionFor(supabase, userId) };
}

/**
 * The gate in front of the two routes that spend money.
 *
 * Returns a Response to send back, or null to carry on. Both ways of being
 * turned away are represented, and they are different: 401 means "you are not
 * signed in", 402 means "you are, and this is on the paid plan". Answering 401
 * to a signed-in writer would send them to a sign-in screen they are already
 * past, which is the sort of loop that gets support mail.
 *
 * Two conditions skip the gate entirely, and both are deliberate. With no
 * Supabase project there are no accounts to bill, and with no gateway
 * configured there is no way to pay — so a self-hosted OpenChapter on its owner's
 * own API keys works exactly as it did before any of this existed. Billing is
 * optional in the same way accounts and the assistant's key are optional.
 */
export async function requirePro(messages: {
  /** Shown to a visitor with no session. */
  signIn: string;
  /** Shown to a signed-in writer on the free plan. */
  upgrade: string;
}): Promise<Response | null> {
  if (!isSupabaseConfigured()) return null;

  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const userId = typeof data?.claims?.sub === "string" ? data.claims.sub : null;

  if (!userId) {
    return Response.json({ error: messages.signIn }, { status: 401 });
  }

  if (!billingConfigured()) return null;

  const subscription = await subscriptionFor(supabase, userId);
  if (isPro(subscription)) return null;

  return Response.json(
    { error: messages.upgrade, upgrade: true },
    { status: 402 },
  );
}
