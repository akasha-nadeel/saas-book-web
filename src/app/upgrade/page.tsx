import { Plans } from "@/components/upgrade/plans";
import { paddleClientConfig } from "@/lib/billing/paddle";
import { asPeriod } from "@/lib/billing/plans";
import { activeProvider } from "@/lib/billing/provider";
import { currentSubscription } from "@/lib/billing/server";
import { planTierOf } from "@/lib/billing/subscription";
import { asPaidTier } from "@/lib/billing/tiers";
import { isSupabaseConfigured } from "@/lib/supabase/config";

/**
 * The plans, at a URL of their own rather than in a dialog.
 *
 * A price is something people link to, come back to, and read before they have
 * an account — none of which a modal over the shelf can do. It is public in the
 * proxy for the same reason.
 *
 * Three things are decided here rather than in the browser, and all three would
 * flicker if they were not: which gateway there is to buy through, whether this
 * writer is already paying, and where the free card's button points.
 *
 * Paddle's client token is passed down rather than read in the component. It is
 * public by design — NEXT_PUBLIC_, and it can do nothing but open a checkout —
 * but reading it here keeps every billing decision on the server, so there is
 * one place to look when the answer is wrong.
 */
export const metadata = {
  title: "Plans · OpenChapter",
};

export default async function UpgradePage(props: PageProps<"/upgrade">) {
  const { cancelled, buy, period } = await props.searchParams;
  const provider = activeProvider();
  const paddle = provider === "paddle" ? paddleClientConfig() : undefined;

  /* **What the writer pressed before they were asked to sign in.**
     `upgradeTo()` builds this on the landing page, `next` carries it through
     the door, and the two values are narrowed here rather than cast: a query
     string is whatever somebody typed, which is the rule `areas.ts` states for
     `?from=`. Anything unrecognised reads as no intent at all and the page is
     the ordinary pricing page.

     Decided on the server with the other three, for the reason above: the
     cycle is the first figure a reader sees, and seeding it in the browser
     would show them the annual price and then swap it. */
  const wanted = asPaidTier(buy);
  const wantedPeriod = asPeriod(period);
  const intent = wanted && wantedPeriod
    ? { tier: wanted, period: wantedPeriod }
    : null;

  // No project configured means no accounts at all; the sign-up screen the
  // button points at says so itself, so there is nothing to branch on here.
  if (!isSupabaseConfigured()) {
    return (
      <Plans
        signedIn={false}
        provider={provider}
        paddle={paddle}
        current={null}
        intent={intent}
      />
    );
  }

  const { userId, subscription } = await currentSubscription();

  /* **The whole subscription, not `pro: boolean`.**
     Every card has to answer for itself now — the plan they are on says "Your
     plan", the ones above say "Upgrade", the ones below say "Switch". A boolean
     could only say "already paying", which is what put "Keep writing" on the
     Studio card in front of a Draft customer and made the dearest plan look
     unavailable to the person most likely to buy it.

     The subscription's *own* provider travels with it, not the deployment's:
     Paddle can swap a price on a live subscription and PayHere cannot, and a
     writer who subscribed through PayHere is still a PayHere subscriber after
     new checkouts have moved to Paddle. */
  const tier = planTierOf(subscription);

  return (
    <Plans
      signedIn={Boolean(userId)}
      provider={provider}
      paddle={paddle}
      current={
        tier === "free" || !subscription
          ? null
          : {
              tier,
              period: subscription.period,
              provider: subscription.provider,
            }
      }
      cancelled={cancelled === "1"}
      intent={intent}
    />
  );
}
