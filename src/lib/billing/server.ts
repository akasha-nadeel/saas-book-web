import { asPaidTier, tierAtLeast, type PlanTier } from "./tiers";
import type { SupabaseClient } from "@supabase/supabase-js";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createClient } from "@/lib/supabase/server";
import { asProvider, billingConfigured } from "./provider";
import { asPeriod } from "./plans";
import {
  asSubscriptionStatus,
  isPro,
  planTierOf,
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
  /* `plan` was written on every purchase and read by nothing until the tiers
     arrived. Narrowed here with the other two, so a row carrying the retired
     'pro' — or anything else the CHECK constraint would now refuse — is treated
     as undescribable rather than silently mapped onto a plan nobody bought. */
  const tier = asPaidTier(row.plan);
  if (!status || !period || !tier) return null;

  const end = row.current_period_end;
  const cancelled = row.cancelled_at;

  return {
    // Rows written before the Paddle migration carry no provider column value
    // of their own; `asProvider` reads them as PayHere, which is what they are.
    provider: asProvider(row.provider),
    tier,
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
/**
 * A session, and nothing more — for a route that is free but must not be open.
 *
 * **Export must never move behind the plan**, so `requirePro` is the wrong tool
 * for `/api/export/pdf`: that route is free for every writer and will stay so.
 * It also must not be *anonymous*. It launches a
 * headless browser, renders markup the caller supplied, and may run for five
 * minutes — with no session check a stranger could spend that, repeatedly, on
 * somebody else's server.
 *
 * The same escape as `requirePro`: with no Supabase project there are no
 * accounts to check, so a self-hosted copy is unchanged.
 */
export async function requireSignedIn(message: string): Promise<Response | null> {
  if (!isSupabaseConfigured()) return null;

  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const userId = typeof data?.claims?.sub === "string" ? data.claims.sub : null;

  return userId ? null : Response.json({ error: message }, { status: 401 });
}

/**
 * The gate for anything sold by *plan* rather than by "is this paid at all".
 *
 * Returns the caller's tier on success, because the route needs it a few lines
 * later to answer the narrower questions — whether the assistant may write into
 * the chapter, and which allowance to spend. One subscription read instead of
 * two.
 *
 * **Both escapes are `requirePro`'s, deliberately.** With no Supabase there are
 * no accounts to check, and with no payment gateway there are no plans and
 * nothing is held back — a self-hosted copy running on its owner's own API key
 * keeps the assistant it always had. Those cases answer `studio`, the same
 * trick `/api/billing/subscription` already plays with `pro: true`, so every
 * caller downstream reads one shape.
 *
 * **402 rather than 403.** In this codebase 402 already means "you are signed
 * in and this is on a paid plan" — `requirePro` and `requireLaunchExport` both
 * use it. A second code for one meaning is a second convention.
 */
export async function requireTier(
  minimum: PlanTier,
  messages: { signIn: string; upgrade: string },
): Promise<{ ok: true; tier: PlanTier } | { ok: false; response: Response }> {
  if (!isSupabaseConfigured()) return { ok: true, tier: "studio" };

  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const userId = typeof data?.claims?.sub === "string" ? data.claims.sub : null;

  if (!userId) {
    return {
      ok: false,
      response: Response.json({ error: messages.signIn }, { status: 401 }),
    };
  }

  if (!billingConfigured()) return { ok: true, tier: "studio" };

  const subscription = await subscriptionFor(supabase, userId);
  const tier = planTierOf(subscription);
  if (tierAtLeast(tier, minimum)) return { ok: true, tier };

  return {
    ok: false,
    response: Response.json(
      { error: messages.upgrade, upgrade: true },
      { status: 402 },
    ),
  };
}

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
