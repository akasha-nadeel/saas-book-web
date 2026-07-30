import { Plans } from "@/components/upgrade/plans";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createClient } from "@/lib/supabase/server";

/**
 * The plans, at a URL of their own rather than in a dialog.
 *
 * A price is something people link to, come back to, and read before they have
 * an account — none of which a modal over the shelf can do. It is public in the
 * proxy for the same reason.
 *
 * All the server decides is which way the free card's button points, since that
 * is the one thing on the page that differs for a writer who is already in.
 */
export const metadata = {
  title: "Plans · OpenChapter",
};

export default async function UpgradePage() {
  // No project configured means no accounts at all; the sign-up screen the
  // button points at says so itself, so there is nothing to branch on here.
  if (!isSupabaseConfigured()) return <Plans signedIn={false} />;

  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();

  return <Plans signedIn={Boolean(data?.claims)} />;
}
