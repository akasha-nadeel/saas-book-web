import { Plans } from "@/components/upgrade/plans";
import { paddleClientConfig } from "@/lib/billing/paddle";
import { activeProvider } from "@/lib/billing/provider";
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
  const { cancelled } = await props.searchParams;
  const provider = activeProvider();
  const paddle = provider === "paddle" ? paddleClientConfig() : undefined;

  // No project configured means no accounts at all; the sign-up screen the
  // button points at says so itself, so there is nothing to branch on here.
  if (!isSupabaseConfigured()) {
    return (
      <Plans signedIn={false} provider={provider} paddle={paddle} pro={false} />
    );
  }

  const { userId, subscription } = await currentSubscription();

  return (
    <Plans
      signedIn={Boolean(userId)}
      provider={provider}
      paddle={paddle}
      pro={isPro(subscription)}
      cancelled={cancelled === "1"}
    />
  );
}
