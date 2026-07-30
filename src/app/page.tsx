import { LandingPage } from "@/components/landing/landing-page";
import { Bookshelf } from "@/components/shelf/bookshelf";
import { accountFromClaims } from "@/lib/account";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createClient } from "@/lib/supabase/server";

/**
 * One route, two pages: the shelf for a writer who is in, the landing page for
 * a visitor who is not.
 *
 * Decided on the server so neither audience sees the other's screen first.
 * getClaims verifies the JWT signature rather than trusting the cookie, which
 * is what makes this safe to branch on. With no project configured there are no
 * accounts at all, so everyone gets the shelf — the app runs as it always has.
 */
export default async function Home() {
  if (!isSupabaseConfigured()) return <Bookshelf account={null} />;

  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();

  if (!data?.claims) return <LandingPage />;

  // Name and photo ride in the verified token itself, so the header can be
  // right on the first paint rather than filling in after a round trip.
  return <Bookshelf account={accountFromClaims(data.claims)} />;
}
