import { Suspense } from "react";
import { MvpLandingPage } from "@/components/landing/mvp-landing-page";
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
  /*
   * The Suspense boundary is only on this branch, and it is load-bearing.
   *
   * With no project configured there is nothing to read cookies for, so `/`
   * has no reason to be dynamic and Next prerenders it — at which point the
   * dashboard's `useSearchParams` (the `?area=` reader) has to be allowed to
   * bail out to the client, and without a boundary the *build* fails rather
   * than the page. That took out `npm run build` for exactly the audience the
   * local-only mode exists for: a fresh clone with no Supabase yet.
   *
   * The other two branches read `getClaims()` first, which makes the route
   * dynamic, so nothing there ever suspends on this.
   */
  if (!isSupabaseConfigured())
    return (
      <Suspense>
        <Bookshelf account={null} />
      </Suspense>
    );

  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();

  if (!data?.claims) return <MvpLandingPage />;

  // Name and photo ride in the verified token itself, so the header can be
  // right on the first paint rather than filling in after a round trip.
  return <Bookshelf account={accountFromClaims(data.claims)} />;
}
