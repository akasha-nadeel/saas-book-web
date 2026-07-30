import { Plans } from "@/components/upgrade/plans";
import { isBillingConfigured } from "@/lib/billing/payhere";
import { currentSubscription } from "@/lib/billing/server";
import { isPro } from "@/lib/billing/subscription";
import { isSupabaseConfigured } from "@/lib/supabase/config";

/**
 * The plans, at a URL of their own rather than in a dialog.
 *
 * A price is something people link to, come back to, and read before they have
 * an account — none of which a modal over the shelf can do. It is public in the
 * proxy for the same reason.
 *
 * Three things are decided here rather than in the browser, and all three would
 * flicker if they were not: whether there is a gateway to buy through, whether
 * this writer is already paying, and where the free card's button points.
 */
export const metadata = {
  title: "Plans · OpenChapter",
};

export default async function UpgradePage(props: PageProps<"/upgrade">) {
  const { cancelled } = await props.searchParams;
  const billing = isBillingConfigured();

  // No project configured means no accounts at all; the sign-up screen the
  // button points at says so itself, so there is nothing to branch on here.
  if (!isSupabaseConfigured()) {
    return <Plans signedIn={false} billing={billing} pro={false} />;
  }

  const { userId, subscription } = await currentSubscription();

  return (
    <Plans
      signedIn={Boolean(userId)}
      billing={billing}
      pro={isPro(subscription)}
      cancelled={cancelled === "1"}
    />
  );
}
