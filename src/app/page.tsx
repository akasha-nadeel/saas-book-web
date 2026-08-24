import type { Metadata } from "next";
import { Suspense } from "react";
import { MvpLandingPage } from "@/components/landing/mvp-landing-page";
import { Bookshelf } from "@/components/shelf/bookshelf";
import { accountFromClaims } from "@/lib/account";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createClient } from "@/lib/supabase/server";

/**
 * What a link to this domain says it is.
 *
 * The root layout's description is about the app a writer is already
 * inside; this is about the product a stranger is deciding on, which is
 * what a shared link, a search result and a payment provider's reviewer all
 * read first. It sits on the route rather than in the layout so the two do
 * not have to be one sentence, and it is true of both halves of this page:
 * the shelf a writer lands on is where that same book lives.
 */
export const metadata: Metadata = {
  title: "OpenChapter · Write your book and leave with the file",
  description:
    "A quiet editor for a whole manuscript — chapters, notes, versions and front matter. Written to your own browser, exported as Word, EPUB or PDF.",
};

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
